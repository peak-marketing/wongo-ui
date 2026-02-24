import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetsController, UploadsController } from './assets.controller';
import { Asset } from './asset.entity';
import { Order } from '../order/order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Asset, Order])],
  controllers: [AssetsController, UploadsController],
})
export class AssetsModule {}


