import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { Wallet, BillingTransaction, TopupRequest } from './billing.entity';
import { AgencyBillingController } from './billing-agency.controller';
import { Order } from '../order/order.entity';
import { AdminBillingController } from './billing-admin.controller';
import { AdminSettlementsController } from './settlements-admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, BillingTransaction, TopupRequest, Order]),
  ],
  providers: [BillingService],
  controllers: [BillingController, AgencyBillingController, AdminBillingController, AdminSettlementsController],
  exports: [BillingService],
})
export class BillingModule {}





