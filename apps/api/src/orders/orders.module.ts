import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order } from '../order/order.entity';
import { Asset } from '../assets/asset.entity';
import { User } from '../user/user.entity';
import { GenerationModule } from '../generation/generation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Asset, User]),
    forwardRef(() => GenerationModule),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}


