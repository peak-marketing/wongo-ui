import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgencyService } from './agency.service';
import { AgencyController } from './agency.controller';
import { AgencyStatsController } from './agency-stats.controller';
import { OrderTemplateController } from './order-template.controller';
import { Order } from '../order/order.entity';
import { BillingTransaction } from '../billing/billing.entity';
import { OrderTemplate } from './order-template.entity';
import { AdminModule } from '../admin/admin.module';
import { BillingModule } from '../billing/billing.module';
import { OrdersModule } from '../orders/orders.module';
import { AgencyProfileController } from './profile/profile.controller';
import { AgencyProfileService } from './profile/profile.service';
import { User } from '../user/user.entity';
import { AgencyMeController } from './me/agency-me.controller';
import { Asset } from '../assets/asset.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, BillingTransaction, OrderTemplate, User, Asset]),
    forwardRef(() => AdminModule),
    BillingModule,
    OrdersModule,
  ],
  providers: [AgencyService, AgencyProfileService],
  controllers: [AgencyController, AgencyStatsController, OrderTemplateController, AgencyProfileController, AgencyMeController],
  exports: [AgencyService],
})
export class AgencyModule {}


