import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order } from '../order/order.entity';
import { OrderStatus } from '../common/enums/order-status.enum';
import { ReviewDecision } from '../common/enums/review-decision.enum';
import { CreateOrderDto } from './dto/create-order.dto';
import { ReviewOrderDto } from './dto/review-order.dto';
import { Inject, forwardRef } from '@nestjs/common';
import { AdminService } from '../admin/admin.service';
import { BillingService } from '../billing/billing.service';
import { User } from '../user/user.entity';
import { Wallet } from '../billing/billing.entity';
import { Asset } from '../assets/asset.entity';
import { Readable } from 'stream';
import { createZipStream } from './deliverable-zip';
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

@Injectable()
export class AgencyService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Asset)
    private assetRepository: Repository<Asset>,
    @Inject(forwardRef(() => AdminService))
    private adminService: AdminService,
    private readonly billingService: BillingService,
    private readonly dataSource: DataSource,
  ) {}

  private getOrderDeliverableZipFileName(orderId: string) {
    return `order_${orderId}_deliverable.zip`;
  }

  private getImageExtensionFromUrl(url: string): string {
    try {
      const u = new URL(url);
      const path = u.pathname || '';
      const last = path.split('/').pop() || '';
      const m = /\.[a-zA-Z0-9]{1,5}$/.exec(last);
      if (!m) return '.jpg';
      return m[0].toLowerCase();
    } catch {
      // Non-standard URLs (blob:, etc.)
      const m = /\.[a-zA-Z0-9]{1,5}(?:\?|#|$)/.exec(url);
      return m ? m[0].toLowerCase().replace(/\?.*$/, '') : '.jpg';
    }
  }

  private async fetchImageStream(url: string): Promise<Readable | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const resp = await fetch(url, { method: 'GET', signal: controller.signal } as any);
      if (!resp.ok) return null;
      if (!resp.body) return null;
      // Node.js Readable from Web ReadableStream
      return Readable.fromWeb(resp.body as any);
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private stripQueryAndHash(value: string) {
    return value.split('#')[0].split('?')[0];
  }

  private buildUploadRootCandidates() {
    try {
      const cwd = process.cwd();
      const candidates = [
        process.env.UPLOAD_DIR,
        path.join(cwd, 'uploads'),
        path.join(cwd, 'public', 'uploads'),
        path.join(cwd, '..', 'uploads'),
        path.join(cwd, '..', 'public', 'uploads'),
      ].filter(Boolean) as string[];
      return Array.from(new Set(candidates));
    } catch {
      // If path/cwd/env handling ever fails, fall back to fetch-only behavior.
      return [];
    }
  }

  private async tryResolveLocalFilePath(photoUrl: string): Promise<string | null> {
    const raw = (photoUrl || '').trim();
    if (!raw) return null;

    // blob: URLs are browser-only (not accessible on server)
    if (raw.startsWith('blob:')) {
      return null;
    }

    // file:// URL
    if (raw.startsWith('file://')) {
      try {
        const p = fileURLToPath(new URL(raw));
        await fs.access(p);
        return p;
      } catch {
        return null;
      }
    }

    // Windows absolute path: C:\... or UNC \\server\share
    if (/^[a-zA-Z]:\\/.test(raw) || raw.startsWith('\\\\')) {
      try {
        await fs.access(raw);
        return raw;
      } catch {
        return null;
      }
    }

    // Parse http(s) URL or treat as path-like string
    let pathname = '';
    try {
      const u = new URL(raw);
      pathname = u.pathname || '';
    } catch {
      pathname = raw;
    }

    pathname = this.stripQueryAndHash(pathname);
    if (!pathname) return null;

    // Normalize to relative segment
    let rel = pathname;
    if (rel.startsWith('/')) rel = rel.slice(1);
    try {
      rel = decodeURIComponent(rel);
    } catch {
      // ignore
    }

    // Special-case: /uploads/... -> map into upload roots
    const uploadRoots = this.buildUploadRootCandidates();
    const uploadRel = rel.startsWith('uploads/') ? rel.slice('uploads/'.length) : null;
    if (uploadRel) {
      for (const root of uploadRoots) {
        const p = path.join(root, uploadRel);
        try {
          await fs.access(p);
          return p;
        } catch {
          // continue
        }
      }
    }

    // Generic candidates: treat rel as path under cwd / upload roots
    const genericRoots = [process.cwd(), ...uploadRoots];
    for (const root of genericRoots) {
      const p = path.join(root, rel);
      try {
        await fs.access(p);
        return p;
      } catch {
        // continue
      }
    }

    return null;
  }

  private async getImageStreamWithFallback(
    photoUrl: string,
  ): Promise<{ stream: Readable | null; source: 'local' | 'fetch' | 'none'; reason?: string }> {
    const raw = (photoUrl || '').trim();
    if (!raw) return { stream: null, source: 'none', reason: 'empty' };

    let localPath: string | null = null;
    try {
      localPath = await this.tryResolveLocalFilePath(raw);
    } catch {
      localPath = null;
    }

    if (localPath) {
      try {
        return { stream: createReadStream(localPath), source: 'local' };
      } catch {
        // fall through to fetch
      }
    }

    // 2nd attempt: http(s) fetch. Also support same-host absolute paths like /uploads/...
    let fetchUrl: string | null = null;
    if (/^https?:\/\//i.test(raw)) {
      fetchUrl = raw;
    } else if (raw.startsWith('/')) {
      const port = process.env.PORT || '3001';
      fetchUrl = `http://localhost:${port}${raw}`;
    }

    if (fetchUrl) {
      try {
        const stream = await this.fetchImageStream(fetchUrl);
        if (stream) return { stream, source: 'fetch' };
        return { stream: null, source: 'none', reason: 'fetch_failed' };
      } catch {
        return { stream: null, source: 'none', reason: 'fetch_exception' };
      }
    }

    if (raw.startsWith('blob:')) {
      return { stream: null, source: 'none', reason: 'blob_url_unsupported' };
    }

    return { stream: null, source: 'none', reason: localPath ? 'local_read_failed' : 'local_not_found' };
  }

  async createDeliverableZipStream(orderId: string, userId: string): Promise<{ stream: Readable; fileName: string }> {
    const fileName = this.getOrderDeliverableZipFileName(orderId);

    const order = await this.findOne(orderId, userId);
    if (order.status !== OrderStatus.COMPLETE) {
      // Fixed rule: only COMPLETE orders can be downloaded
      throw new ForbiddenException('Order must be COMPLETE to download deliverables');
    }

    const manuscript = String(order.manuscript || '');

    // Primary: orders.photos array order (upload order)
    const primaryUrls = Array.isArray(order.photos) ? order.photos.filter(Boolean) : [];

    // Fallback: assets.createdAt asc
    let photoUrls: string[] = primaryUrls;
    if (photoUrls.length === 0) {
      const assets = await this.assetRepository.find({ where: { orderId }, order: { createdAt: 'ASC' } });
      photoUrls = assets.map((a) => a.url).filter(Boolean);
    }

    const zipEntries: Array<{ kind: 'buffer' | 'stream'; fileName: string; data?: Buffer; stream?: Readable }> = [];
    zipEntries.push({ kind: 'buffer', fileName: '00_원고.txt', data: Buffer.from(manuscript, 'utf8') });

    const photosTotal = photoUrls.filter((u) => typeof u === 'string' && u.trim().length > 0).length;
    let photosAdded = 0;
    let photosSkipped = 0;

    for (let i = 0; i < photoUrls.length; i++) {
      const url = photoUrls[i];
      if (typeof url !== 'string' || url.trim().length === 0) continue;

      try {
        const ext = this.getImageExtensionFromUrl(url);
        const index = String(i + 1).padStart(2, '0');
        const name = `${index}${ext || '.jpg'}`;

        const { stream, source, reason } = await this.getImageStreamWithFallback(url);
        if (!stream) {
          photosSkipped += 1;
          console.log(
            `${new Date().toISOString()} (ORDER_ZIP_PHOTO_ADD) (FAIL) (${orderId}|${i + 1}|${url}|${reason || 'unknown'})`,
          );
          continue;
        }

        photosAdded += 1;
        zipEntries.push({ kind: 'stream', fileName: name, stream });
        console.log(
          `${new Date().toISOString()} (ORDER_ZIP_PHOTO_ADD) (SUCCESS) (${orderId}|${i + 1}|${url}|${source})`,
        );
      } catch (e: any) {
        photosSkipped += 1;
        console.log(
          `${new Date().toISOString()} (ORDER_ZIP_PHOTO_ADD) (FAIL) (${orderId}|${i + 1}|${url}|exception)` +
            (e?.message ? `:${String(e.message)}` : ''),
        );
      }
    }

    let stream: Readable;
    let result: Promise<{ bytes: number }>;
    try {
      const created = createZipStream(
        zipEntries.map((e) =>
          e.kind === 'buffer'
            ? ({ kind: 'buffer', fileName: e.fileName, data: e.data! } as const)
            : ({ kind: 'stream', fileName: e.fileName, stream: e.stream! } as const),
        ),
      );
      stream = created.stream;
      result = created.result;
    } catch {
      const fallback = createZipStream([{ kind: 'buffer', fileName: '00_원고.txt', data: Buffer.from(manuscript, 'utf8') }]);
      stream = fallback.stream;
      result = fallback.result;
    }

    // Single log line (SUCCESS/FAIL) with bytes.
    result
      .then((r) => {
        console.log(
          `${new Date().toISOString()} (ORDER_DELIVERABLE_ZIP) (SUCCESS) (${orderId}|${photosTotal}|${photosAdded}|${photosSkipped}|${r.bytes})`,
        );
      })
      .catch(() => {
        console.log(
          `${new Date().toISOString()} (ORDER_DELIVERABLE_ZIP) (FAIL) (${orderId}|${photosTotal}|${photosAdded}|${photosSkipped}|0)`,
        );
      });

    return { stream, fileName };
  }

  async create(userId: string, createOrderDto: CreateOrderDto): Promise<Order> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const defaultUnitPrice = user?.defaultUnitPrice && user.defaultUnitPrice > 0 ? user.defaultUnitPrice : 0;

    const order = this.orderRepository.create({
      ...createOrderDto,
      agencyId: userId,
      status: OrderStatus.DRAFT,
      unitPrice: defaultUnitPrice,
    });
    return this.orderRepository.save(order);
  }

  async findAll(
    userId: string,
    options: {
      status?: string;
      query?: string;
      completedDate?: string;
      page?: number;
      sort?: string;
    } = {},
  ): Promise<{
    items: any[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  }> {
    const pageSize = 20;
    const page = options.page && options.page > 0 ? options.page : 1;
    const skip = (page - 1) * pageSize;

    const qb = this.orderRepository.createQueryBuilder('order').where('order.agencyId = :userId', { userId });

    const writingStatuses: OrderStatus[] = [
      OrderStatus.SUBMITTED,
      OrderStatus.ADMIN_INTAKE,
      OrderStatus.GENERATING,
      OrderStatus.GENERATED,
      OrderStatus.ADMIN_REVIEW,
      OrderStatus.REGEN_QUEUED,
      OrderStatus.ADMIN_REJECTED,
      OrderStatus.REVISION_REQUESTED,
      OrderStatus.FAILED,
    ];

    const bucket = options.status;
    if (bucket === 'writing') {
      qb.andWhere('order.status IN (:...statuses)', { statuses: writingStatuses });
    } else if (bucket === 'firstReview') {
      qb.andWhere('order.status = :status', { status: OrderStatus.AGENCY_REVIEW });
    } else if (bucket === 'todayDone') {
      qb.andWhere('order.status = :status', { status: OrderStatus.COMPLETE });

      const timezoneOffsetMs = 9 * 3600 * 1000; // Asia/Seoul (UTC+9)
      const nowUtc = new Date();
      const seoulNow = new Date(nowUtc.getTime() + timezoneOffsetMs);
      const todayKst = `${seoulNow.getUTCFullYear()}-${String(seoulNow.getUTCMonth() + 1).padStart(2, '0')}-${String(seoulNow.getUTCDate()).padStart(2, '0')}`;
      const effectiveDate = (options.completedDate && options.completedDate.trim().length > 0)
        ? options.completedDate.trim()
        : todayKst;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
        throw new BadRequestException('completedDate는 YYYY-MM-DD 형식이어야 합니다');
      }

      const startUtc = new Date(`${effectiveDate}T00:00:00.000+09:00`);
      if (Number.isNaN(startUtc.getTime())) {
        throw new BadRequestException('completedDate가 올바르지 않습니다');
      }
      const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);

      qb.andWhere('order.completedAt >= :startOfDay AND order.completedAt < :endOfDay', {
        startOfDay: startUtc,
        endOfDay: endUtc,
      });
    }

    if (options.query && options.query.trim().length > 0) {
      const term = `%${options.query.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(order.placeName) LIKE :term OR LOWER(order.searchKeywords) LIKE :term)',
        { term },
      );
    }

    let sortField = 'updatedAt';
    let sortDirection: 'ASC' | 'DESC' = 'DESC';

    if (options.sort) {
      const [field, dir] = options.sort.split(',');
      const allowedFields = new Set(['updatedAt', 'createdAt', 'completedAt']);
      if (field && allowedFields.has(field)) {
        sortField = field;
      }
      if (dir && dir.toLowerCase() === 'asc') {
        sortDirection = 'ASC';
      }
    }

    qb.orderBy(`order.${sortField}`, sortDirection).skip(skip).take(pageSize);

    const [records, total] = await qb.getManyAndCount();
    const sanitized = records.map((order) => this.sanitizeForAgency(order));

    return {
      items: sanitized,
      total,
      page,
      pageSize,
      hasMore: skip + records.length < total,
    };
  }

  async findOne(id: string, userId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['agency'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.agencyId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return order;
  }

  async submit(id: string, userId: string): Promise<Order> {
    const order = await this.findOne(id, userId);
    
    if (order.status !== OrderStatus.DRAFT) {
      throw new ForbiddenException('Only draft orders can be submitted');
    }

    order.status = OrderStatus.SUBMITTED;
    order.completedAt = null;
    return this.orderRepository.save(order);
  }

  async review(id: string, userId: string, reviewDto: ReviewOrderDto): Promise<Order> {
    const order = await this.findOne(id, userId);

    if (reviewDto.decision === ReviewDecision.APPROVE) {
      // 멱등: 이미 차감된 주문은 즉시 성공 처리 (추가 차감 금지)
      if (order.chargedAt) {
        const wallet = await this.billingService.getWallet(order.agencyId);
        const unitPrice = Number(order.unitPrice ?? 0);
        const balance = wallet?.balance ?? 0;
        console.log(
          `${new Date().toISOString()} (CHARGE_ON_APPROVE) (SUCCESS) (${order.id}|${order.agencyId}|${unitPrice}|${balance}|${balance}|true)`,
        );
        return order;
      }

      if (order.status !== OrderStatus.AGENCY_REVIEW) {
        // v2.5: 상태 불일치 시 409 반환
        throw new ConflictException('Order status changed; review not allowed');
      }

      const now = new Date();
      const unitPrice = Number(order.unitPrice ?? 0);

      // 로그에 찍을 값 (실패 시에도 best-effort로 채움)
      let balanceBefore = 0;
      let balanceAfter = 0;
      const chargedFlag = Boolean(order.chargedAt);

      try {
        const saved = await this.dataSource.transaction(async (manager) => {
          const orderRepo = manager.getRepository(Order);

          const lockedOrder = await orderRepo
            .createQueryBuilder('o')
            .setLock('pessimistic_write')
            .where('o.id = :id', { id })
            .getOne();

          if (!lockedOrder) {
            throw new NotFoundException('Order not found');
          }
          if (lockedOrder.agencyId !== userId) {
            throw new ForbiddenException('Access denied');
          }
          if (lockedOrder.status !== OrderStatus.AGENCY_REVIEW) {
            throw new ConflictException('Order status changed; review not allowed');
          }

          // 멱등: 이미 차감된 주문이면 추가 차감/캡처 금지
          if (lockedOrder.chargedAt) {
            return lockedOrder;
          }

          const walletRepo = manager.getRepository(Wallet);
          const wallet = await walletRepo
            .createQueryBuilder('w')
            .setLock('pessimistic_write')
            .where('w.userId = :userId', { userId: lockedOrder.agencyId })
            .getOne();
          balanceBefore = wallet?.balance ?? 0;

          const captureResult = await this.billingService.captureWithResult(lockedOrder.id, manager);
          balanceBefore = captureResult.balanceBefore;
          balanceAfter = captureResult.balanceAfter;

          lockedOrder.chargedAt = now;
          lockedOrder.status = OrderStatus.COMPLETE;
          lockedOrder.completedAt = now;
          lockedOrder.approveCount = (lockedOrder.approveCount || 0) + 1;

          return orderRepo.save(lockedOrder);
        });

        console.log(
          `${new Date().toISOString()} (CHARGE_ON_APPROVE) (SUCCESS) (${saved.id}|${saved.agencyId}|${unitPrice}|${balanceBefore}|${balanceAfter}|${chargedFlag})`,
        );
        return saved;
      } catch (error) {
        // 실패 시 상태/잔액은 트랜잭션 롤백으로 유지
        balanceAfter = balanceAfter || balanceBefore;
        console.log(
          `${new Date().toISOString()} (CHARGE_ON_APPROVE) (FAIL) (${order.id}|${order.agencyId}|${unitPrice}|${balanceBefore}|${balanceAfter}|${chargedFlag})`,
        );
        throw error;
      }
    } else if (reviewDto.decision === ReviewDecision.REJECT) {
      if (order.status !== OrderStatus.AGENCY_REVIEW) {
        // v2.5: 상태 불일치 시 409 반환
        throw new ConflictException('Order status changed; review not allowed');
      }

      const prevStatus = order.status;
      const reason = (reviewDto.reason ?? '').trim();
      if (!reason) {
        throw new BadRequestException('reason is required');
      }

      const currentRevisionCount = Math.trunc(Number((order as any).revisionCount ?? 0));
      if (Number.isFinite(currentRevisionCount) && currentRevisionCount >= 1) {
        throw new BadRequestException('수정요청은 1회만 가능합니다');
      }

      order.status = OrderStatus.SUBMITTED;
      order.rejectionReason = reason;
      order.completedAt = null;
      (order as any).revisionCount = 1;

      try {
        const saved = await this.orderRepository.save(order);
        console.log(
          `${new Date().toISOString()} (AGENCY_REVISION_REQUEST) (SUCCESS) (${saved.id}|${prevStatus}->SUBMITTED|${reason.length})`,
        );
        return saved;
      } catch (error) {
        console.log(
          `${new Date().toISOString()} (AGENCY_REVISION_REQUEST) (FAIL) (${order.id}|${prevStatus}->SUBMITTED|${reason.length})`,
        );
        throw error;
      }
    }

    throw new ForbiddenException('Invalid decision');
  }

  // Helper to sanitize order response for agency (remove persona snapshot)
  sanitizeForAgency(order: Order): any {
    const { personaSnapshot, ...rest } = order;
    
    // Hide manuscript unless in AGENCY_REVIEW or COMPLETE
    if (order.status !== OrderStatus.AGENCY_REVIEW && order.status !== OrderStatus.COMPLETE) {
      return {
        ...rest,
        manuscript: null,
      };
    }
    
    return rest;
  }

  async cancel(id: string, userId: string, reason: string): Promise<Order> {
    const order = await this.findOne(id, userId);

    const cancelableStatuses: ReadonlySet<OrderStatus> = new Set([
      OrderStatus.DRAFT,
      OrderStatus.SUBMITTED,
      OrderStatus.ADMIN_INTAKE,
      OrderStatus.GENERATING,
      OrderStatus.GENERATED,
      OrderStatus.ADMIN_REVIEW,
      OrderStatus.ADMIN_REJECTED,
      OrderStatus.REVISION_REQUESTED,
      OrderStatus.REGEN_QUEUED,
      OrderStatus.FAILED,
    ]);

    if (!cancelableStatuses.has(order.status)) {
      throw new ConflictException('주문을 취소할 수 없는 상태입니다');
    }

    order.status = OrderStatus.CANCELED_BY_AGENCY;
    order.canceledAt = new Date();
    order.cancelRequestedAt = null;
    order.cancelReason = reason;

    const saved = await this.orderRepository.save(order);

    try {
      await this.billingService.release(order.id);
    } catch (error) {
      // release 실패 시에도 취소 자체는 성공 처리
      console.warn('Failed to release billing on cancel', { orderId: order.id, error });
    }

    return saved;
  }

  async cancelRequest(id: string, userId: string, reason: string): Promise<Order> {
    const order = await this.findOne(id, userId);
    
    // 허용 상태: GENERATING, REGEN_QUEUED
    if (order.status !== OrderStatus.GENERATING && order.status !== OrderStatus.REGEN_QUEUED) {
      throw new ConflictException('작성 중단 요청을 할 수 없는 상태입니다');
    }

    // 상태 변경
    order.status = OrderStatus.CANCEL_REQUESTED;
    order.cancelRequestedAt = new Date();
    order.cancelReason = reason;

    return this.orderRepository.save(order);
  }
}

