import { PassThrough, Readable } from 'stream';
import { once } from 'events';

// Minimal streaming ZIP writer (STORE, no compression).
// Uses data-descriptor flag so sizes/CRC can be written after streaming content.

type ZipEntrySource =
  | { kind: 'buffer'; fileName: string; data: Buffer }
  | { kind: 'stream'; fileName: string; stream: NodeJS.ReadableStream };

const ZIP_LOCAL_FILE_HEADER_SIG = 0x04034b50;
const ZIP_CENTRAL_DIR_HEADER_SIG = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIR_SIG = 0x06054b50;
const ZIP_DATA_DESCRIPTOR_SIG = 0x08074b50;

const VERSION_NEEDED = 20;
const VERSION_MADE_BY = 20;

// Bit 3: data descriptor present, Bit 11: UTF-8 filenames
const GPBF_DATA_DESCRIPTOR_UTF8 = 0x0008 | 0x0800;
const METHOD_STORE = 0;

function u16(n: number) {
  const b = Buffer.allocUnsafe(2);
  b.writeUInt16LE(n & 0xffff, 0);
  return b;
}

function u32(n: number) {
  const b = Buffer.allocUnsafe(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

function crc32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = crc32Table();

function crc32Update(crc: number, chunk: Buffer): number {
  let c = (crc ^ 0xffffffff) >>> 0;
  for (let i = 0; i < chunk.length; i++) {
    c = CRC_TABLE[(c ^ chunk[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

async function writeWithBackpressure(out: PassThrough, buf: Buffer, state: { bytes: number }) {
  state.bytes += buf.length;
  if (!out.write(buf)) {
    await once(out, 'drain');
  }
}

async function pipeWithBackpressure(
  out: PassThrough,
  src: NodeJS.ReadableStream,
  state: { bytes: number },
  onChunk?: (buf: Buffer) => void,
): Promise<void> {
  for await (const chunk of src as any) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    onChunk?.(buf);
    await writeWithBackpressure(out, buf, state);
  }
}

function buildLocalHeader(fileNameBytes: Buffer) {
  // Local file header (30 bytes) + filename
  const header = Buffer.allocUnsafe(30);
  let o = 0;
  header.writeUInt32LE(ZIP_LOCAL_FILE_HEADER_SIG, o); o += 4;
  header.writeUInt16LE(VERSION_NEEDED, o); o += 2;
  header.writeUInt16LE(GPBF_DATA_DESCRIPTOR_UTF8, o); o += 2;
  header.writeUInt16LE(METHOD_STORE, o); o += 2;
  header.writeUInt16LE(0, o); o += 2; // mod time
  header.writeUInt16LE(0, o); o += 2; // mod date
  header.writeUInt32LE(0, o); o += 4; // crc
  header.writeUInt32LE(0, o); o += 4; // comp size
  header.writeUInt32LE(0, o); o += 4; // uncomp size
  header.writeUInt16LE(fileNameBytes.length, o); o += 2;
  header.writeUInt16LE(0, o); o += 2; // extra len
  return Buffer.concat([header, fileNameBytes]);
}

function buildDataDescriptor(crc: number, size: number) {
  // signature + crc32 + comp size + uncomp size
  return Buffer.concat([
    u32(ZIP_DATA_DESCRIPTOR_SIG),
    u32(crc),
    u32(size),
    u32(size),
  ]);
}

function buildCentralDirHeader(meta: {
  fileNameBytes: Buffer;
  crc: number;
  size: number;
  localHeaderOffset: number;
}) {
  const header = Buffer.allocUnsafe(46);
  let o = 0;
  header.writeUInt32LE(ZIP_CENTRAL_DIR_HEADER_SIG, o); o += 4;
  header.writeUInt16LE(VERSION_MADE_BY, o); o += 2;
  header.writeUInt16LE(VERSION_NEEDED, o); o += 2;
  header.writeUInt16LE(GPBF_DATA_DESCRIPTOR_UTF8, o); o += 2;
  header.writeUInt16LE(METHOD_STORE, o); o += 2;
  header.writeUInt16LE(0, o); o += 2; // mod time
  header.writeUInt16LE(0, o); o += 2; // mod date
  header.writeUInt32LE(meta.crc >>> 0, o); o += 4;
  header.writeUInt32LE(meta.size >>> 0, o); o += 4;
  header.writeUInt32LE(meta.size >>> 0, o); o += 4;
  header.writeUInt16LE(meta.fileNameBytes.length, o); o += 2;
  header.writeUInt16LE(0, o); o += 2; // extra
  header.writeUInt16LE(0, o); o += 2; // comment
  header.writeUInt16LE(0, o); o += 2; // disk start
  header.writeUInt16LE(0, o); o += 2; // internal attrs
  header.writeUInt32LE(0, o); o += 4; // external attrs
  header.writeUInt32LE(meta.localHeaderOffset >>> 0, o); o += 4;
  return Buffer.concat([header, meta.fileNameBytes]);
}

function buildEndOfCentralDir(meta: { entries: number; centralDirSize: number; centralDirOffset: number }) {
  const eocd = Buffer.allocUnsafe(22);
  let o = 0;
  eocd.writeUInt32LE(ZIP_END_OF_CENTRAL_DIR_SIG, o); o += 4;
  eocd.writeUInt16LE(0, o); o += 2; // disk
  eocd.writeUInt16LE(0, o); o += 2; // start disk
  eocd.writeUInt16LE(meta.entries, o); o += 2;
  eocd.writeUInt16LE(meta.entries, o); o += 2;
  eocd.writeUInt32LE(meta.centralDirSize >>> 0, o); o += 4;
  eocd.writeUInt32LE(meta.centralDirOffset >>> 0, o); o += 4;
  eocd.writeUInt16LE(0, o); o += 2; // comment len
  return eocd;
}

export function createZipStream(entries: ZipEntrySource[]) {
  const out = new PassThrough();
  const state = { bytes: 0 };

  const result = (async () => {
    const central: Array<{ fileNameBytes: Buffer; crc: number; size: number; localHeaderOffset: number }> = [];
    let offset = 0;

    try {
      for (const entry of entries) {
        const fileNameBytes = Buffer.from(entry.fileName, 'utf8');
        const localHeaderOffset = offset;

        const localHeader = buildLocalHeader(fileNameBytes);
        await writeWithBackpressure(out, localHeader, state);
        offset += localHeader.length;

        let crc = 0;
        let size = 0;

        if (entry.kind === 'buffer') {
          const data = entry.data;
          crc = crc32Update(crc, data);
          size = data.length;
          await writeWithBackpressure(out, data, state);
          offset += data.length;
        } else {
          await pipeWithBackpressure(out, entry.stream, state, (buf) => {
            crc = crc32Update(crc, buf);
            size += buf.length;
          });
          offset += size;
        }

        const dd = buildDataDescriptor(crc, size);
        await writeWithBackpressure(out, dd, state);
        offset += dd.length;

        central.push({ fileNameBytes, crc, size, localHeaderOffset });
      }

      const centralDirOffset = offset;
      let centralDirSize = 0;
      for (const c of central) {
        const hdr = buildCentralDirHeader(c);
        await writeWithBackpressure(out, hdr, state);
        centralDirSize += hdr.length;
        offset += hdr.length;
      }

      const eocd = buildEndOfCentralDir({
        entries: central.length,
        centralDirSize,
        centralDirOffset,
      });
      await writeWithBackpressure(out, eocd, state);
      offset += eocd.length;

      out.end();
      return { bytes: state.bytes, entries: central.length };
    } catch (err) {
      out.destroy(err as Error);
      throw err;
    }
  })();

  return { stream: out as Readable, result };
}
