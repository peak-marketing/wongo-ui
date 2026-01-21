import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminAgenciesController } from './agencies/admin-agencies.controller';
import { Order } from '../order/order.entity';
import { User } from '../user/user.entity';
import { Asset } from '../assets/asset.entity';
import { AgencyModule } from '../agency/agency.module';
import { BillingModule } from '../billing/billing.module';
import { GenerationModule } from '../generation/generation.module';
import { ValidationModule } from '../validation/validation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, User, Asset]),
    forwardRef(() => AgencyModule),
    BillingModule,
    GenerationModule,
    ValidationModule,
  ],
  providers: [AdminService],
  controllers: [AdminController, AdminUsersController, AdminAgenciesController],
  exports: [AdminService],
})
export class AdminModule {}

