import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { BillingService } from './billing.service';
import { GetUser } from '../common/decorators/get-user.decorator';

@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Get('wallet')
  async getWallet(@GetUser() user: any) {
    return this.billingService.getWallet(user.id);
  }

  @Post('topups')
  async topup(@GetUser() user: any, @Body() body: { amount: number }) {
    return this.billingService.topup(user.id, body.amount);
  }

  @Post('reserve')
  @Roles(UserRole.ADMIN)
  async reserve(@Body() body: { orderId: string; amount?: number }) {
    await this.billingService.reserve(body.orderId, body.amount || 1);
    return { success: true };
  }

  @Post('capture')
  async capture(@Body() body: { orderId: string }) {
    await this.billingService.capture(body.orderId);
    return { success: true };
  }

  @Post('release')
  async release(@Body() body: { orderId: string }) {
    await this.billingService.release(body.orderId);
    return { success: true };
  }
}









