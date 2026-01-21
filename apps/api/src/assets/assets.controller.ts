import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  Get,
  UseGuards,
  UploadedFiles,
  UseInterceptors,
  Req,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from './asset.entity';
import { Order } from '../order/order.entity';
import { GetUser } from '../common/decorators/get-user.decorator';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import type { Request, Response } from 'express';

interface PhotoMetaDto {
  url: string;
  width: number;
  height: number;
  sizeKb: number;
  exif?: string;
}

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_SIZE_KB = 10 * 1024; // 10MB
const MIN_PHOTOS = 5;
const MAX_PHOTOS = 20;

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

function safeBasename(name: string) {
  return path.basename(name);
}

function generateFilename(originalName: string) {
  const ext = path.extname(originalName || '').toLowerCase();
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now();
  return `${ts}_${rand}${ext}`;
}

function isAllowedExtension(url: string): boolean {
  const lower = url.toLowerCase();
  return ALLOWED_EXTENSIONS.some(ext => lower.endsWith(ext));
}

function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    // 도메인 화이트리스트 검증 (예시: 실제 구현에서는 환경변수에서 가져옴)
    const allowedDomains = process.env.ALLOWED_S3_DOMAINS?.split(',') || [];
    if (allowedDomains.length > 0 && !allowedDomains.some(domain => urlObj.hostname.includes(domain))) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

@Controller('/orders/:id/assets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.AGENCY)
export class AssetsController {
  constructor(
    @InjectRepository(Asset)
    private assetRepository: Repository<Asset>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
  ) {}

  @Post()
  async addAssets(
    @Param('id') id: string,
    @Body() body: { photos: PhotoMetaDto[] },
    @GetUser() user: any,
  ) {
    const order = await this.orderRepository.findOne({ where: { id } });
    if (!order) {
      throw new BadRequestException('Order not found');
    }

    // 권한 확인: 대행사 본인 주문만
    if (order.agencyId !== (user.id || user.userId)) {
      throw new BadRequestException('Access denied');
    }

    const { photos } = body;
    if (!Array.isArray(photos) || photos.length === 0) {
      throw new BadRequestException('사진이 필요합니다');
    }

    // 개수 검증
    const existingCount = await this.assetRepository.count({ where: { orderId: id } });
    const totalCount = existingCount + photos.length;
    
    if (totalCount < MIN_PHOTOS) {
      throw new BadRequestException(`사진은 최소 ${MIN_PHOTOS}장이 필요합니다`);
    }
    if (totalCount > MAX_PHOTOS) {
      throw new BadRequestException(`사진은 최대 ${MAX_PHOTOS}장까지 업로드할 수 있습니다`);
    }

    // 각 사진 검증 및 저장
    const assets: Asset[] = [];
    for (const photo of photos) {
      // 확장자 검증
      if (!isAllowedExtension(photo.url)) {
        throw new BadRequestException(`허용되지 않은 파일 형식입니다. (${ALLOWED_EXTENSIONS.join(', ')}만 가능)`);
      }

      // 용량 검증
      if (photo.sizeKb > MAX_SIZE_KB) {
        throw new BadRequestException(`파일 크기는 ${MAX_SIZE_KB / 1024}MB를 초과할 수 없습니다`);
      }

      // URL 유효성 검증
      if (!isValidUrl(photo.url)) {
        throw new BadRequestException('유효하지 않은 URL입니다');
      }

      const asset = this.assetRepository.create({
        orderId: id,
        url: photo.url,
        width: photo.width,
        height: photo.height,
        sizeKb: photo.sizeKb,
        exif: photo.exif || null,
      });
      assets.push(asset);
    }

    await this.assetRepository.save(assets);

    // 주문의 photos 필드 업데이트
    const photoUrls = photos.map(p => p.url);
    order.photos = [...(order.photos || []), ...photoUrls];
    await this.orderRepository.save(order);

    return { ok: true, count: assets.length };
  }

  @Get()
  async getAssets(@Param('id') id: string, @GetUser() user: any) {
    const order = await this.orderRepository.findOne({ where: { id } });
    if (!order) {
      throw new BadRequestException('Order not found');
    }

    if (order.agencyId !== (user.id || user.userId)) {
      throw new BadRequestException('Access denied');
    }

    const assets = await this.assetRepository.find({ where: { orderId: id } });
    return assets;
  }
}

@Controller('/uploads')
export class UploadsController {
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.AGENCY)
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          try {
            ensureUploadDir();
            cb(null, UPLOAD_DIR);
          } catch (e) {
            cb(e as any, UPLOAD_DIR);
          }
        },
        filename: (_req, file, cb) => {
          const name = generateFilename(file.originalname);
          cb(null, name);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 20,
      },
      fileFilter: (_req, file, cb) => {
        const lower = (file.originalname || '').toLowerCase();
        const ok = ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
        if (!ok) {
          return cb(new BadRequestException('허용되지 않은 파일 형식입니다. (JPG, JPEG, PNG, WEBP만 가능)') as any, false);
        }
        cb(null, true);
      },
    }),
  )
  async upload(@UploadedFiles() files: Array<{ filename: string }>, @Req() req: Request) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new BadRequestException('업로드할 파일이 없습니다');
    }

    const origin = (() => {
      const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined) || '';
      const proto = forwardedProto.split(',')[0]?.trim() || req.protocol;
      const host = req.get('host');
      return `${proto}://${host}`;
    })();

    const urls = files.map((f) => `${origin}/uploads/${encodeURIComponent(f.filename)}`);
    return { urls };
  }

  @Get(':fileName')
  async serve(@Param('fileName') fileName: string, @Res() res: Response) {
    const safeName = safeBasename(fileName);
    if (!safeName || safeName !== fileName) {
      throw new BadRequestException('유효하지 않은 파일명입니다');
    }

    const fullPath = path.join(UPLOAD_DIR, safeName);
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('파일을 찾을 수 없습니다');
    }

    return res.sendFile(fullPath);
  }
}
