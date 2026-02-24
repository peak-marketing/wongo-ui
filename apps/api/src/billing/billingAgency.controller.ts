import { Controller, Get, Post, Body, Query, Param, UseGuards, Headers, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { GetUser } from '../common/decorators/get-user.decorator';
import { BillingService } from './billing.service';

@Controller('agency')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.AGENCY)
export class AgencyBillingController {
  constructor(private readonly billing: BillingService) {}

  // 2-1 조회: 지갑 요약
  @Get('wallet')
  async getWallet(@GetUser() user: any) {
    const summary = await this.billing.getWalletSummary(user.id);
    return { ...summary, currency: 'KRW' };
  }

  // 2-1 조회: 거래 내역
  @Get('transactions')
  async getTransactions(
    @GetUser() user: any,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('min') min?: string,
    @Query('max') max?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));
    return this.billing.listTransactions(user.id, { type, from, to, min, max, page: p, pageSize: ps });
  }

  // 2-1 조회: 충전 요청 목록
  @Get('topups')
  async getTopups(@GetUser() user: any, @Query('status') status?: string, @Query('page') page?: string) {
    const p = Math.max(1, Number(page) || 1);
    return this.billing.listTopups(user.id, { status, page: p });
  }

  // 2-2 충전 요청 생성
  @Post('topups')
  async createTopup(
    @GetUser() user: any,
    @Body() body: { amount: number; method?: 'REQUEST'; memo?: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!Number.isInteger(body.amount)) {
      throw new BadRequestException('금액은 정수여야 합니다');
    }
    if (body.amount < 10000 || body.amount > 5000000) {
      throw new BadRequestException('충전 금액은 10,000~5,000,000원입니다');
    }
    const result = await this.billing.createTopupRequest(user.id, body.amount, body.memo, idempotencyKey);
    return result;
  }

  // 단건 조회
  @Get('topups/:id')
  async getTopup(@GetUser() user: any, @Param('id') id: string) {
    return this.billing.getTopup(user.id, id);
  }

  // 취소
  @Post('topups/:id/cancel')
  async cancelTopup(@GetUser() user: any, @Param('id') id: string) {
    return this.billing.cancelTopup(user.id, id);
  }
}
