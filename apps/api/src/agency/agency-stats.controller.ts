import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { GetUser } from '../common/decorators/get-user.decorator';
import { OrderStatus } from '../common/enums/order-status.enum';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from '../order/order.entity';
import { BillingService } from '../billing/billing.service';
import { BillingTransaction } from '../billing/billing.entity';

@Controller('agency/stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.AGENCY)
export class AgencyStatsController {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(BillingTransaction)
    private transactionRepository: Repository<BillingTransaction>,
    private billingService: BillingService,
  ) {}

  @Get()
  async getStats(@GetUser() user: any) {
    const userId = user.id || user.userId;
    const orders = await this.orderRepository.find({
      where: { agencyId: userId },
    });

    const writingStatuses = new Set<OrderStatus>([
      OrderStatus.DRAFT,
      OrderStatus.SUBMITTED,
      OrderStatus.ADMIN_INTAKE,
      OrderStatus.GENERATING,
      OrderStatus.GENERATED,
      OrderStatus.ADMIN_REVIEW,
      OrderStatus.REGEN_QUEUED,
      OrderStatus.AGENCY_REJECTED,
      OrderStatus.ADMIN_REJECTED,
      OrderStatus.REVISION_REQUESTED,
      OrderStatus.FAILED,
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let writing = 0;
    let firstReview = 0;
    let todayDone = 0;

    orders.forEach((order) => {
      const status = order.status as OrderStatus;

      if (status === OrderStatus.AGENCY_REVIEW) {
        firstReview += 1;
        return;
      }

      if (status === OrderStatus.COMPLETE) {
        if (order.completedAt && order.completedAt >= today && order.completedAt < tomorrow) {
          todayDone += 1;
        }
        return;
      }

      if (writingStatuses.has(status)) {
        writing += 1;
        return;
      }

      // 정의되지 않은 상태는 기본적으로 작성 중 버킷으로 분류
      writing += 1;
    });

    // 지갑 정보
    const wallet = await this.billingService.getWallet(userId);
    const balance = wallet.balance || 0;

    // 총 사용 금액 계산 (캡처된 트랜잭션의 합)
    const transactions = await this.transactionRepository.find({
      where: { userId, type: 'CAPTURE', status: 'COMPLETED' },
    });
    const spentTotal = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);

    return {
      writing,
      firstReview,
      todayDone,
      balance: Math.round(balance),
      spentTotal: Math.round(spentTotal),
    };
  }
}

