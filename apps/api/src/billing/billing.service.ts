import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, In } from 'typeorm';
import { Wallet, BillingTransaction, TopupRequest } from './billing.entity';
import { Order } from '../order/order.entity';
import { User } from '../user/user.entity';
import { UserRole } from '../common/enums/user-role.enum';
import * as ExcelJS from 'exceljs';

@Injectable()
export class BillingService {
  private static readonly ADMIN_UNIT_COST = 1500;
  private static readonly SETTLEMENT_TOPUP_TYPES = ['TOPUP_REQUEST', 'TOPUP_APPROVED', 'TOPUP'] as const;

  constructor(
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(BillingTransaction)
    private transactionRepository: Repository<BillingTransaction>,
    @InjectRepository(TopupRequest)
    private topupRepository: Repository<TopupRequest>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private dataSource: DataSource,
  ) {}

  async getOrCreateWallet(userId: string): Promise<Wallet> {
    let wallet = await this.walletRepository.findOne({ where: { userId } });
    if (!wallet) {
      wallet = this.walletRepository.create({ userId, balance: 0, reserved: 0 });
      wallet = await this.walletRepository.save(wallet);
    }
    return wallet;
  }

  async getOrCreateWalletForUpdate(userId: string, manager: EntityManager): Promise<Wallet> {
    const walletRepo = manager.getRepository(Wallet);

    let wallet = await walletRepo
      .createQueryBuilder('w')
      .setLock('pessimistic_write')
      .where('w.userId = :userId', { userId })
      .getOne();

    if (!wallet) {
      wallet = walletRepo.create({ userId, balance: 0, reserved: 0 });
      wallet = await walletRepo.save(wallet);
    }

    return wallet;
  }

  async getWallet(userId: string): Promise<Wallet> {
    return this.getOrCreateWallet(userId);
  }

  async topup(userId: string, amount: number): Promise<Wallet> {
    const wallet = await this.getOrCreateWallet(userId);

    const transaction = this.transactionRepository.create({
      userId,
      type: 'TOPUP_APPROVED',
      amount,
      status: 'COMPLETED',
      units: 0,
    });
    await this.transactionRepository.save(transaction);

    wallet.balance += amount;
    return this.walletRepository.save(wallet);
  }

  async reserve(orderId: string, amount: number = 1): Promise<void> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const units = (() => {
      const raw = (order as any)?.payload?.outputCount;
      const n = Math.trunc(Number(raw));
      if (n === 5) return 5;
      if (n === 10) return 10;
      return 1;
    })();

    // reserve amount는 실제 금액(포인트)이며, 기본은 최소 보증(=1)이지만
    // outputCount가 큰 타입(예: 영수증 리뷰)에서는 units만큼 예약하도록 caller가 amount를 넘길 수 있다.
    const reserveAmount = Math.max(1, Math.trunc(Number(amount || 1)));

    const wallet = await this.getOrCreateWallet(order.agencyId);

    if (wallet.balance - wallet.reserved < reserveAmount) {
      throw new BadRequestException('Insufficient balance');
    }

    wallet.reserved += reserveAmount;
    await this.walletRepository.save(wallet);

    const transaction = this.transactionRepository.create({
      userId: order.agencyId,
      orderId,
      type: 'RESERVE',
      amount: reserveAmount,
      status: 'COMPLETED',
      units,
    });
    await this.transactionRepository.save(transaction);
  }

  async captureWithResult(orderId: string, manager: EntityManager): Promise<{ balanceBefore: number; balanceAfter: number }> {
    const orderRepo = manager.getRepository(Order);
    const txRepo = manager.getRepository(BillingTransaction);

    const order = await orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // 멱등: 이미 CAPTURE가 있으면 추가 차감 금지
    const existingCapture = await txRepo.findOne({
      where: { orderId, type: 'CAPTURE', status: 'COMPLETED' },
      order: { createdAt: 'DESC' },
    });
    if (existingCapture) {
      const wallet = await this.getOrCreateWalletForUpdate(order.agencyId, manager);
      return { balanceBefore: wallet.balance, balanceAfter: wallet.balance };
    }

    const wallet = await this.getOrCreateWalletForUpdate(order.agencyId, manager);
    const balanceBefore = wallet.balance;

    const reserveTransaction = await txRepo.findOne({
      where: { orderId, type: 'RESERVE', status: 'COMPLETED' },
      order: { createdAt: 'DESC' },
    });

    if (!reserveTransaction) {
      throw new BadRequestException('No reserve found for this order');
    }

    const reservedAmount = Number(reserveTransaction.amount ?? 0);
    const units = Math.max(1, Math.trunc(Number(reserveTransaction.units ?? 1)));
    const unitPrice = Math.max(0, Math.trunc(Number(order.unitPrice ?? 0)));
    const chargeAmount = unitPrice * units;

    const additionalAmount = Math.max(0, chargeAmount - reservedAmount);
    const available = wallet.balance - wallet.reserved;
    if (available < additionalAmount) {
      throw new BadRequestException('Insufficient balance');
    }

    // reserved는 기존 예약분만 해제, balance는 최종 단가(unitPrice)만큼 차감
    wallet.reserved = Math.max(0, wallet.reserved - reservedAmount);
    wallet.balance -= chargeAmount;
    await manager.getRepository(Wallet).save(wallet);

    const transaction = txRepo.create({
      userId: order.agencyId,
      orderId,
      type: 'CAPTURE',
      amount: chargeAmount,
      status: 'COMPLETED',
      units,
    });
    await txRepo.save(transaction);

    return { balanceBefore, balanceAfter: wallet.balance };
  }

  async capture(orderId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.captureWithResult(orderId, manager);
    });
  }

  async release(orderId: string): Promise<void> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const wallet = await this.getOrCreateWallet(order.agencyId);
    
    // Find the reserve transaction
    const reserveTransaction = await this.transactionRepository.findOne({
      where: { orderId, type: 'RESERVE', status: 'COMPLETED' },
      order: { createdAt: 'DESC' },
    });

    if (!reserveTransaction) {
      return; // No reserve to release
    }

    const existingRelease = await this.transactionRepository.findOne({
      where: { orderId, type: 'RELEASE', status: 'COMPLETED' },
    });

    if (existingRelease) {
      return; // 이미 해제 완료
    }

    const amount = reserveTransaction.amount;
    const units = reserveTransaction.units ?? 1;

    // Release reserved amount
    wallet.reserved = Math.max(0, wallet.reserved - amount);
    await this.walletRepository.save(wallet);

    const transaction = this.transactionRepository.create({
      userId: order.agencyId,
      orderId,
      type: 'RELEASE',
      amount,
      status: 'COMPLETED',
      units,
    });
    await this.transactionRepository.save(transaction);
  }

  // ----- v3.0 Agency APIs helpers -----

  async getWalletSummary(userId: string): Promise<{ balance: number; reserved: number; available: number; spentTotal: number }> {
    const wallet = await this.getOrCreateWallet(userId);
    const raw = await this.transactionRepository
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.amount), 0)', 'sum')
      .where('t.userId = :userId', { userId })
      .andWhere('t.type = :type', { type: 'CAPTURE' })
      .andWhere('t.status = :status', { status: 'COMPLETED' })
      .getRawOne<{ sum: string }>();
    const spentTotal = Number(raw?.sum ?? 0);
    const available = wallet.balance - wallet.reserved;
    return { balance: wallet.balance, reserved: wallet.reserved, available, spentTotal };
  }

  async listTransactions(
    userId: string,
    filters: { type?: string; from?: string; to?: string; min?: string; max?: string; page: number; pageSize: number },
  ) {
    const qb = this.transactionRepository.createQueryBuilder('t').where('t.userId = :userId', { userId });
    if (filters.type) qb.andWhere('t.type = :type', { type: filters.type });
    if (filters.from) qb.andWhere('t.createdAt >= :from', { from: this.toKstStart(filters.from) });
    if (filters.to) qb.andWhere('t.createdAt <= :to', { to: this.toKstEnd(filters.to) });
    if (filters.min) qb.andWhere('t.amount >= :min', { min: Number(filters.min) });
    if (filters.max) qb.andWhere('t.amount <= :max', { max: Number(filters.max) });
    qb.orderBy('t.createdAt', 'DESC')
      .skip((filters.page - 1) * filters.pageSize)
      .take(filters.pageSize);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page: filters.page, pageSize: filters.pageSize };
  }

  async listAllTransactions(
    userId: string,
    filters: { type?: string; from?: string; to?: string; min?: string; max?: string },
  ): Promise<BillingTransaction[]> {
    const qb = this.transactionRepository.createQueryBuilder('t').where('t.userId = :userId', { userId });
    if (filters.type) qb.andWhere('t.type = :type', { type: filters.type });
    if (filters.from) qb.andWhere('t.createdAt >= :from', { from: this.toKstStart(filters.from) });
    if (filters.to) qb.andWhere('t.createdAt <= :to', { to: this.toKstEnd(filters.to) });
    if (filters.min) qb.andWhere('t.amount >= :min', { min: Number(filters.min) });
    if (filters.max) qb.andWhere('t.amount <= :max', { max: Number(filters.max) });
    qb.orderBy('t.createdAt', 'DESC');
    return qb.getMany();
  }

  private nowIso() {
    return new Date().toISOString();
  }

  private async getTransactionForUpdate(txId: string, manager: EntityManager): Promise<BillingTransaction> {
    const txRepo = manager.getRepository(BillingTransaction);
    const tx = await txRepo
      .createQueryBuilder('t')
      .setLock('pessimistic_write')
      .where('t.id = :id', { id: txId })
      .getOne();
    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }
    return tx;
  }

  async listLedgerAdmin(
    limit: number = 100,
    status: 'ALL' | 'PENDING' | 'COMPLETED' = 'ALL',
  ): Promise<
    Array<{
      id: string;
      createdAt: Date;
      userId: string;
      userEmail: string | null;
      businessName: string | null;
      businessRegNo: string | null;
      orderId: string | null;
      type: BillingTransaction['type'];
      amount: number;
      status: string;
      units: number;
      memo: string | null;
      walletBalance: number | null;
      walletReserved: number | null;
      walletAvailable: number | null;
    }>
  > {
    const take = Math.min(Math.max(Math.trunc(Number(limit) || 100), 1), 100);

    const qb = this.transactionRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.user', 'u')
      .orderBy('t.createdAt', 'DESC')
      .take(take);

    if (status !== 'ALL') {
      qb.andWhere('t.status = :status', { status });
    }

    const items = await qb.getMany();

    const userIds = Array.from(new Set(items.map((t) => t.userId).filter(Boolean)));
    const wallets = userIds.length
      ? await this.walletRepository.find({ where: { userId: In(userIds) } })
      : [];
    const walletByUserId = new Map(wallets.map((w) => [w.userId, w] as const));

    return items.map((t) => {
      const wallet = walletByUserId.get(t.userId);
      const balance = wallet?.balance;
      const reserved = wallet?.reserved;
      const available = typeof balance === 'number' && typeof reserved === 'number' ? balance - reserved : null;

      return {
        id: t.id,
        createdAt: t.createdAt,
        userId: t.userId,
        userEmail: (t.user as any)?.email ?? null,
        businessName: (t.user as any)?.businessName ?? null,
        businessRegNo: (t.user as any)?.businessRegNo ?? null,
        orderId: t.orderId ?? null,
        type: t.type,
        amount: t.amount,
        status: (t as any).status ?? null,
        units: t.units,
        memo: (t as any).memo ?? null,
        walletBalance: typeof balance === 'number' ? balance : null,
        walletReserved: typeof reserved === 'number' ? reserved : null,
        walletAvailable: available,
      };
    });
  }

  async approveTopupTransactionAdmin(txId: string) {
    const startedAt = this.nowIso();
    try {
      const result = await this.dataSource.transaction(async (manager) => {
        const txRepo = manager.getRepository(BillingTransaction);
        const walletRepo = manager.getRepository(Wallet);
        const topupRepo = manager.getRepository(TopupRequest);

        const tx = await this.getTransactionForUpdate(txId, manager);
        const statusBefore = (tx as any).status as string;

        if (tx.type !== 'TOPUP_REQUEST') {
          throw new BadRequestException('Not a topup request transaction');
        }

        // 멱등: 이미 COMPLETED면 재처리 금지
        if (statusBefore === 'COMPLETED') {
          console.log(`(${startedAt}) (TOPUP_APPROVE) (SUCCESS) (${tx.id}|${tx.userId}|${tx.amount}|${statusBefore}->COMPLETED)`);
          return { tx, statusBefore, statusAfter: 'COMPLETED', walletChanged: false };
        }

        if (statusBefore !== 'PENDING') {
          throw new BadRequestException('Not pending');
        }

        const wallet = await this.getOrCreateWalletForUpdate(tx.userId, manager);
        wallet.balance += tx.amount;
        await walletRepo.save(wallet);

        (tx as any).status = 'COMPLETED';
        await txRepo.save(tx);

        if (tx.topupRequestId) {
          const req = await topupRepo.findOne({ where: { id: tx.topupRequestId } });
          if (req) {
            req.status = 'APPROVED';
            await topupRepo.save(req);
          }
        }

        return { tx, statusBefore, statusAfter: 'COMPLETED', walletChanged: true };
      });

      console.log(
        `(${startedAt}) (TOPUP_APPROVE) (SUCCESS) (${result.tx.id}|${result.tx.userId}|${result.tx.amount}|${result.statusBefore}->${result.statusAfter})`,
      );
      return { ok: true };
    } catch (error) {
      try {
        console.log(`(${startedAt}) (TOPUP_APPROVE) (FAIL) (${txId}|unknown|unknown|unknown->unknown)`);
      } catch {
        // ignore
      }
      throw error;
    }
  }

  async rejectTopupTransactionAdmin(txId: string, reason: string) {
    const startedAt = this.nowIso();
    const reasonLen = (reason ?? '').trim().length;
    try {
      if (!reasonLen) {
        throw new BadRequestException('Reason is required');
      }

      const result = await this.dataSource.transaction(async (manager) => {
        const txRepo = manager.getRepository(BillingTransaction);
        const topupRepo = manager.getRepository(TopupRequest);

        const tx = await this.getTransactionForUpdate(txId, manager);
        const statusBefore = (tx as any).status as string;

        if (tx.type !== 'TOPUP_REQUEST') {
          throw new BadRequestException('Not a topup request transaction');
        }

        // 멱등: 이미 완료/거절이면 재처리 금지
        if (statusBefore === 'COMPLETED' || statusBefore === 'REJECTED') {
          return { tx, statusBefore, statusAfter: statusBefore };
        }

        if (statusBefore !== 'PENDING') {
          throw new BadRequestException('Not pending');
        }

        // 상태/사유 저장
        (tx as any).status = 'REJECTED';
        (tx as any).memo = reason;
        await txRepo.save(tx);

        if (tx.topupRequestId) {
          const req = await topupRepo.findOne({ where: { id: tx.topupRequestId } });
          if (req) {
            req.status = 'REJECTED';
            req.memo = reason;
            await topupRepo.save(req);
          }
        }

        return { tx, statusBefore, statusAfter: 'REJECTED' };
      });

      console.log(`(${startedAt}) (TOPUP_REJECT) (SUCCESS) (${result.tx.id}|${result.tx.userId}|${result.tx.amount}|${reasonLen})`);
      return { ok: true };
    } catch (error) {
      try {
        console.log(`(${startedAt}) (TOPUP_REJECT) (FAIL) (${txId}|unknown|unknown|${reasonLen})`);
      } catch {
        // ignore
      }
      throw error;
    }
  }

  async exportLedgerAdminXlsx(limit: number = 100, status: 'ALL' | 'PENDING' | 'COMPLETED' = 'ALL'): Promise<Buffer> {
    const items = await this.listLedgerAdmin(limit, status);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('원장내역');

    worksheet.columns = [
      { header: '일시', key: 'createdAt', width: 22 },
      { header: '사업자명', key: 'businessName', width: 18 },
      { header: '사업자등록번호', key: 'businessRegNo', width: 18 },
      { header: '이메일', key: 'userEmail', width: 26 },
      { header: '유형', key: 'type', width: 16 },
      { header: '금액', key: 'amount', width: 12 },
      { header: '상태', key: 'status', width: 12 },
      { header: '주문ID', key: 'orderId', width: 40 },
      { header: '사유/메모', key: 'memo', width: 30 },
      { header: '잔액', key: 'walletBalance', width: 12 },
      { header: '가용', key: 'walletAvailable', width: 12 },
    ];

    worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

    for (const t of items) {
      worksheet.addRow({
        createdAt: new Date(t.createdAt).toLocaleString('ko-KR'),
        businessName: t.businessName ?? '',
        businessRegNo: t.businessRegNo ?? '',
        userEmail: t.userEmail ?? '',
        type: t.type,
        amount: t.amount,
        status: t.status,
        orderId: t.orderId ?? '',
        memo: t.memo ?? '',
        walletBalance: typeof t.walletBalance === 'number' ? t.walletBalance : '',
        walletAvailable: typeof t.walletAvailable === 'number' ? t.walletAvailable : '',
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async listTopups(userId: string, filters: { status?: string; page: number }) {
    const qb = this.topupRepository.createQueryBuilder('r').where('r.userId = :userId', { userId });
    if (filters.status) qb.andWhere('r.status = :status', { status: filters.status });
    qb.orderBy('r.createdAt', 'DESC').skip((filters.page - 1) * 20).take(20);
    const [items, total] = await qb.getManyAndCount();
    const user = await this.dataSource.getRepository(User).findOne({ where: { id: userId } });
    const requesterEmail = user?.email || '';
    return { items: items.map((item) => ({ ...item, requesterEmail })), total, page: filters.page, pageSize: 20 };
  }

  async createTopupRequest(userId: string, amount: number, memo?: string, _idempotencyKey?: string) {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('Invalid amount');
    }
    // Best-effort idempotency: return existing recent pending request with same amount/memo
    const existing = await this.topupRepository.findOne({ where: { userId, amount, status: 'PENDING', memo } });
    const user = await this.dataSource.getRepository(User).findOne({ where: { id: userId } });
    const requesterEmail = user?.email || '';
    if (existing) return { ...existing, requesterEmail };

    const request = this.topupRepository.create({ userId, amount, memo, status: 'PENDING' });
    const saved = await this.topupRepository.save(request);

    // Record a pending transaction for audit trail
    const tx = this.transactionRepository.create({
      userId,
      type: 'TOPUP_REQUEST',
      amount,
      status: 'PENDING',
      topupRequestId: saved.id,
      memo,
      units: 0,
    });
    await this.transactionRepository.save(tx);

    return { ...saved, requesterEmail };
  }

  async getTopup(userId: string, id: string) {
    const req = await this.topupRepository.findOne({ where: { id, userId } });
    if (!req) throw new NotFoundException('Topup request not found');
    const user = await this.dataSource.getRepository(User).findOne({ where: { id: userId } });
    const requesterEmail = user?.email || '';
    return { ...req, requesterEmail };
  }

  async cancelTopup(userId: string, id: string) {
    const req = await this.topupRepository.findOne({ where: { id, userId } });
    if (!req) throw new NotFoundException('Topup request not found');
    if (req.status !== 'PENDING') throw new BadRequestException('취소할 수 없는 상태입니다');

    // Update topup request status
    req.status = 'CANCELED';
    await this.topupRepository.save(req);

    // Update related transaction status to CANCELED
    const relatedTx = await this.transactionRepository.findOne({
      where: { topupRequestId: id, userId, type: 'TOPUP_REQUEST' },
    });
    if (relatedTx && relatedTx.status === 'PENDING') {
      relatedTx.status = 'CANCELED';
      relatedTx.units = 0;
      await this.transactionRepository.save(relatedTx);
    }

    return req;
  }

  async exportTransactionsXlsx(
    userId: string,
    filters: { type?: string; from?: string; to?: string; min?: string; max?: string },
  ) {
    const transactions = await this.listAllTransactions(userId, filters);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('거래내역');

    // 헤더 정의
    worksheet.columns = [
      { header: '일시', key: 'createdAt', width: 20 },
      { header: '유형', key: 'type', width: 15 },
      { header: '내역(수량)', key: 'detail', width: 20 },
      { header: '금액', key: 'amount', width: 15 },
      { header: '상태', key: 'status', width: 12 },
    ];

    // 첫 행 고정
    worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

    // 데이터 추가
    transactions.forEach((tx) => {
      const typeLabel = this.getTypeLabel(tx.type);
      const statusLabel = this.getStatusLabel(tx.status);
      const detail = this.getDetailWithUnits(tx.type, tx.units);
      
      worksheet.addRow({
        createdAt: this.formatKstDateTime(tx.createdAt),
        type: typeLabel,
        detail,
        amount: tx.amount,
        status: statusLabel,
      });
    });

    // 금액 서식 적용
    worksheet.getColumn('amount').numFmt = '#,##0"원"';

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  private getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      RESERVE: '예약',
      CAPTURE: '사용',
      RELEASE: '해제',
      TOPUP_REQUEST: '충전요청',
      TOPUP_APPROVED: '충전승인',
      ADJUST: '조정',
      REFUND: '환불',
    };
    return labels[type] || type;
  }

  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDING: '대기',
      COMPLETED: '완료',
      FAILED: '실패',
      CANCELED: '취소',
    };
    return labels[status] || status;
  }

  private getDetailWithUnits(type: string, units: number): string {
    const typeLabels: Record<string, string> = {
      RESERVE: '예약',
      CAPTURE: '사용',
      RELEASE: '해제',
    };
    
    if (typeLabels[type] && units > 0) {
      return `${typeLabels[type]} ${units}건`;
    }
    
    return typeLabels[type] || '-';
  }

  private formatKstDateTime(date: Date): string {
    if (!date) return '-';
    const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().replace('T', ' ').slice(0, 19);
  }

  private toKstStart(date: string): Date {
    if (!date) return new Date();
    return new Date(`${date}T00:00:00+09:00`);
  }

  private toKstEnd(date: string): Date {
    if (!date) return new Date();
    return new Date(`${date}T23:59:59.999+09:00`);
  }

  private formatKstYmd(date: Date): string {
    // Intl 기반: YYYY-MM-DD
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(date);
  }

  private kstTodayYmd(): string {
    return this.formatKstYmd(new Date());
  }

  private addDaysKst(ymd: string, days: number): string {
    const base = new Date(`${ymd}T00:00:00+09:00`);
    const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    return this.formatKstYmd(next);
  }

  private parseRangeDays(range: string | undefined, defaultDays: number = 30): number {
    const raw = String(range ?? '').trim();
    if (!raw) return defaultDays;

    const m = raw.match(/^(\d+)d$/i);
    if (!m) return defaultDays;
    const days = Math.trunc(Number(m[1]));
    if (!Number.isFinite(days) || days <= 0) return defaultDays;
    return Math.min(days, 365);
  }

  async getSettlementSummaryAdmin(start: string, end: string, query?: string): Promise<
    Array<{
      userId: string;
      email: string | null;
      businessName: string | null;
      businessRegNo: string | null;
      lastTopupAt: Date | null;
      topupSum: number;
      captureSum: number;
      captureCount: number;
      adminCostSum: number;
      profitSum: number;
      net: number;
    }>
  > {
    const startAt = this.toKstStart(start);
    const endAt = this.toKstEnd(end);

    const q = (query ?? '').trim().toLowerCase();
    const topupTypes = Array.from(BillingService.SETTLEMENT_TOPUP_TYPES);
    const types = [...topupTypes, 'CAPTURE'];

    const qb = this.transactionRepository
      .createQueryBuilder('t')
      .leftJoin('t.user', 'u')
      .select('t.userId', 'userId')
      .addSelect('u.email', 'email')
      .addSelect('u.businessName', 'businessName')
      .addSelect('u.businessRegNo', 'businessRegNo')
      .addSelect(
        'MAX(CASE WHEN t.type IN (:...topupTypes) THEN t.createdAt ELSE NULL END)',
        'lastTopupAt',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN t.type IN (:...topupTypes) THEN t.amount ELSE 0 END), 0)',
        'topupSum',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN t.type = 'CAPTURE' THEN t.amount ELSE 0 END), 0)",
        'captureSum',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN t.type = 'CAPTURE' THEN 1 ELSE 0 END), 0)",
        'captureCount',
      )
      .where('t.status = :status', { status: 'COMPLETED' })
      .andWhere('t.type IN (:...types)', { types })
      .andWhere('t.createdAt >= :startAt', { startAt })
      .andWhere('t.createdAt <= :endAt', { endAt })
      .setParameters({ topupTypes })
      .groupBy('t.userId')
      .addGroupBy('u.email')
      .addGroupBy('u.businessName')
      .addGroupBy('u.businessRegNo')
      .orderBy('u.businessName', 'ASC');

    if (q) {
      qb.andWhere(
        '(LOWER(u.email) LIKE :q OR LOWER(u.businessName) LIKE :q OR LOWER(u.businessRegNo) LIKE :q)',
        { q: `%${q}%` },
      );
    }

    const rows = await qb.getRawMany<{
      userId: string;
      email: string | null;
      businessName: string | null;
      businessRegNo: string | null;
      lastTopupAt: Date | string | null;
      topupSum: string;
      captureSum: string;
      captureCount: string;
    }>();

    return rows.map((r) => {
      const topupSum = Number(r.topupSum ?? 0);
      const captureSum = Number(r.captureSum ?? 0);
      const captureCount = Number(r.captureCount ?? 0);
      const adminCostSum = captureCount * BillingService.ADMIN_UNIT_COST;
      const profitSum = captureSum - adminCostSum;
      const lastTopupAt = r.lastTopupAt ? new Date(r.lastTopupAt as any) : null;
      return {
        userId: r.userId,
        email: r.email ?? null,
        businessName: r.businessName ?? null,
        businessRegNo: r.businessRegNo ?? null,
        lastTopupAt,
        topupSum,
        captureSum,
        captureCount,
        adminCostSum,
        profitSum,
        net: topupSum - captureSum,
      };
    });
  }

  async getSettlementKpiAdmin(dateYmd: string): Promise<{
    date: string;
    todayTopupSum: number;
    todayCaptureSum: number;
    todayCaptureCount: number;
    todayProfitSum: number;
  }> {
    const startAt = this.toKstStart(dateYmd);
    const endAt = this.toKstEnd(dateYmd);
    const topupTypes = Array.from(BillingService.SETTLEMENT_TOPUP_TYPES);

    const row = await this.transactionRepository
      .createQueryBuilder('t')
      .select(
        'COALESCE(SUM(CASE WHEN t.type IN (:...topupTypes) THEN t.amount ELSE 0 END), 0)',
        'todayTopupSum',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN t.type = 'CAPTURE' THEN t.amount ELSE 0 END), 0)",
        'todayCaptureSum',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN t.type = 'CAPTURE' THEN 1 ELSE 0 END), 0)",
        'todayCaptureCount',
      )
      .where('t.status = :status', { status: 'COMPLETED' })
      .andWhere('t.createdAt >= :startAt', { startAt })
      .andWhere('t.createdAt <= :endAt', { endAt })
      .andWhere('t.type IN (:...types)', { types: [...topupTypes, 'CAPTURE'] })
      .setParameters({ topupTypes })
      .getRawOne<{ todayTopupSum: string; todayCaptureSum: string; todayCaptureCount: string }>();

    const todayTopupSum = Number(row?.todayTopupSum ?? 0);
    const todayCaptureSum = Number(row?.todayCaptureSum ?? 0);
    const todayCaptureCount = Number(row?.todayCaptureCount ?? 0);
    const todayProfitSum = todayCaptureSum - todayCaptureCount * BillingService.ADMIN_UNIT_COST;

    return {
      date: dateYmd,
      todayTopupSum,
      todayCaptureSum,
      todayCaptureCount,
      todayProfitSum,
    };
  }

  async listSettlementAgenciesAdmin(query?: string): Promise<
    Array<{
      userId: string;
      businessName: string | null;
      businessRegNo: string | null;
      email: string | null;
    }>
  > {
    const q = (query ?? '').trim().toLowerCase();
    const topupTypes = Array.from(BillingService.SETTLEMENT_TOPUP_TYPES);
    const types = [...topupTypes, 'CAPTURE'];

    // 대행사(User) 목록을 기준으로, 최근 거래일(lastTxAt)을 서브쿼리로 붙여 정렬한다.
    // (최근 거래가 없어도 리스트에 보이게 해서 “데이터 없음”을 줄임)
    const userRepo = this.dataSource.getRepository(User);

    const qb = userRepo
      .createQueryBuilder('u')
      .leftJoin(
        (sub) =>
          sub
            .from(BillingTransaction, 't')
            .select('t.userId', 'user_id')
            .addSelect('MAX(t.createdAt)', 'last_tx_at')
            .where('t.type IN (:...types)', { types })
            .groupBy('t.userId'),
        'tx',
        'tx.user_id = u.id',
      )
      .select('u.id', 'userId')
      .addSelect('u.businessName', 'businessName')
      .addSelect('u.businessRegNo', 'businessRegNo')
      .addSelect('u.email', 'email')
      .where('u.role = :role', { role: UserRole.AGENCY })
      .orderBy('tx.last_tx_at', 'DESC', 'NULLS LAST')
      .addOrderBy('u.businessName', 'ASC')
      .take(100);

    if (q) {
      qb.andWhere(
        '(LOWER(u.email) LIKE :q OR LOWER(u.businessName) LIKE :q OR LOWER(u.businessRegNo) LIKE :q)',
        { q: `%${q}%` },
      );
    }

    const rows = await qb.getRawMany<{
      userId: string;
      businessName: string | null;
      businessRegNo: string | null;
      email: string | null;
    }>();

    return rows.map((r) => ({
      userId: r.userId,
      businessName: r.businessName ?? null,
      businessRegNo: r.businessRegNo ?? null,
      email: r.email ?? null,
    }));
  }

  async getSettlementByAgencyAdmin(userId: string, range?: string): Promise<{
    userId: string;
    range: string;
    start: string;
    end: string;
    summary: {
      topupSum: number;
      captureSum: number;
      captureCount: number;
      adminCostSum: number;
      profitSum: number;
      lastTopupAt: Date | null;
    };
    details: Array<{
      id: string;
      createdAt: Date;
      type: BillingTransaction['type'];
      amount: number;
      status: string;
      orderId: string | null;
      memo: string | null;
    }>;
  }> {
    const days = this.parseRangeDays(range, 30);
    const end = this.kstTodayYmd();
    const start = this.addDaysKst(end, -(days - 1));

    const startAt = this.toKstStart(start);
    const endAt = this.toKstEnd(end);
    const topupTypes = Array.from(BillingService.SETTLEMENT_TOPUP_TYPES);

    const summaryRow = await this.transactionRepository
      .createQueryBuilder('t')
      .select(
        'MAX(CASE WHEN t.type IN (:...topupTypes) THEN t.createdAt ELSE NULL END)',
        'lastTopupAt',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN t.type IN (:...topupTypes) THEN t.amount ELSE 0 END), 0)',
        'topupSum',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN t.type = 'CAPTURE' THEN t.amount ELSE 0 END), 0)",
        'captureSum',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN t.type = 'CAPTURE' THEN 1 ELSE 0 END), 0)",
        'captureCount',
      )
      .where('t.userId = :userId', { userId })
      .andWhere('t.status = :status', { status: 'COMPLETED' })
      .andWhere('t.type IN (:...types)', { types: [...topupTypes, 'CAPTURE'] })
      .andWhere('t.createdAt >= :startAt', { startAt })
      .andWhere('t.createdAt <= :endAt', { endAt })
      .setParameters({ topupTypes })
      .getRawOne<{ lastTopupAt: Date | string | null; topupSum: string; captureSum: string; captureCount: string }>();

    const topupSum = Number(summaryRow?.topupSum ?? 0);
    const captureSum = Number(summaryRow?.captureSum ?? 0);
    const captureCount = Number(summaryRow?.captureCount ?? 0);
    const adminCostSum = captureCount * BillingService.ADMIN_UNIT_COST;
    const profitSum = captureSum - adminCostSum;
    const lastTopupAt = summaryRow?.lastTopupAt ? new Date(summaryRow.lastTopupAt as any) : null;

    // 상세는 상태 포함해서 보여주기(충전/차감만)
    const detailTypes = [...topupTypes, 'CAPTURE'];
    const details = await this.transactionRepository
      .createQueryBuilder('t')
      .where('t.userId = :userId', { userId })
      .andWhere('t.type IN (:...types)', { types: detailTypes })
      .andWhere('t.createdAt >= :startAt', { startAt })
      .andWhere('t.createdAt <= :endAt', { endAt })
      .orderBy('t.createdAt', 'DESC')
      .take(100)
      .getMany();

    return {
      userId,
      range: `${days}d`,
      start,
      end,
      summary: {
        topupSum,
        captureSum,
        captureCount,
        adminCostSum,
        profitSum,
        lastTopupAt,
      },
      details: details.map((t) => ({
        id: t.id,
        createdAt: t.createdAt,
        type: t.type,
        amount: t.amount,
        status: (t as any).status ?? '',
        orderId: t.orderId ?? null,
        memo: (t as any).memo ?? null,
      })),
    };
  }

  async getSettlementDetailsAdmin(
    userId: string,
    start: string,
    end: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<{
    items: Array<{
      id: string;
      createdAt: Date;
      type: BillingTransaction['type'];
      amount: number;
      status: string;
      orderId: string | null;
      memo: string | null;
    }>;
    total: number;
    limit: number;
    offset: number;
  }> {
    const startAt = this.toKstStart(start);
    const endAt = this.toKstEnd(end);

    const take = Math.min(Math.max(Math.trunc(Number(limit) || 100), 1), 200);
    const skip = Math.max(Math.trunc(Number(offset) || 0), 0);

    const topupTypes = Array.from(BillingService.SETTLEMENT_TOPUP_TYPES);
    const types = [...topupTypes, 'CAPTURE'];

    const qb = this.transactionRepository
      .createQueryBuilder('t')
      .where('t.userId = :userId', { userId })
      .andWhere('t.type IN (:...types)', { types })
      .andWhere('t.createdAt >= :startAt', { startAt })
      .andWhere('t.createdAt <= :endAt', { endAt })
      .orderBy('t.createdAt', 'DESC')
      .skip(skip)
      .take(take);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((t) => ({
        id: t.id,
        createdAt: t.createdAt,
        type: t.type,
        amount: t.amount,
        status: (t as any).status ?? '',
        orderId: t.orderId ?? null,
        memo: (t as any).memo ?? null,
      })),
      total,
      limit: take,
      offset: skip,
    };
  }

  async getSettlementDailyAdmin(
    userId: string,
    start: string,
    end: string,
  ): Promise<
    Array<{
      ymd: string;
      captureSum: number;
      captureCount: number;
      adminCostSum: number;
      profitSum: number;
    }>
  > {
    const startAt = this.toKstStart(start);
    const endAt = this.toKstEnd(end);

    const rows = await this.transactionRepository
      .createQueryBuilder('t')
      .select('t.createdAt', 'createdAt')
      .addSelect('t.amount', 'amount')
      .where('t.userId = :userId', { userId })
      .andWhere('t.status = :status', { status: 'COMPLETED' })
      .andWhere('t.type = :type', { type: 'CAPTURE' })
      .andWhere('t.createdAt >= :startAt', { startAt })
      .andWhere('t.createdAt <= :endAt', { endAt })
      .orderBy('t.createdAt', 'ASC')
      .getRawMany<{ createdAt: Date | string; amount: string }>();

    const byDay = new Map<string, { captureSum: number; captureCount: number }>();
    for (const r of rows) {
      const createdAt = new Date((r as any).createdAt);
      if (Number.isNaN(createdAt.getTime())) continue;

      const ymd = this.formatKstYmd(createdAt);
      const amount = Number((r as any).amount ?? 0);
      const cur = byDay.get(ymd) ?? { captureSum: 0, captureCount: 0 };
      cur.captureSum += amount;
      cur.captureCount += 1;
      byDay.set(ymd, cur);
    }

    return Array.from(byDay.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([ymd, v]) => {
        const adminCostSum = v.captureCount * BillingService.ADMIN_UNIT_COST;
        const profitSum = v.captureSum - adminCostSum;
        return {
          ymd,
          captureSum: v.captureSum,
          captureCount: v.captureCount,
          adminCostSum,
          profitSum,
        };
      });
  }

  async exportSettlementSummaryXlsx(
    start: string,
    end: string,
  ): Promise<{ buffer: Buffer; rows: number }> {
    const items = await this.getSettlementSummaryAdmin(start, end);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('정산요약');

    worksheet.columns = [
      { header: '대행사명', key: 'businessName', width: 18 },
      { header: '사업자등록번호', key: 'businessRegNo', width: 18 },
      { header: '이메일', key: 'email', width: 28 },
      { header: '마지막 충전일', key: 'lastTopupAt', width: 20 },
      { header: '충전합(완료)', key: 'topupSum', width: 14 },
      { header: '차감합(매출)', key: 'captureSum', width: 14 },
      { header: '차감건수', key: 'captureCount', width: 10 },
      { header: '관리자원가합', key: 'adminCostSum', width: 12 },
      { header: '순이익', key: 'profitSum', width: 12 },
      { header: '순증감', key: 'net', width: 12 },
    ];

    worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

    for (const r of items) {
      worksheet.addRow({
        businessName: r.businessName ?? '',
        businessRegNo: r.businessRegNo ?? '',
        email: r.email ?? '',
        lastTopupAt: r.lastTopupAt ? this.formatKstDateTime(r.lastTopupAt) : '',
        topupSum: r.topupSum,
        captureSum: r.captureSum,
        captureCount: r.captureCount,
        adminCostSum: r.adminCostSum,
        profitSum: r.profitSum,
        net: r.net,
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return { buffer: Buffer.from(buffer), rows: items.length };
  }
}





