import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Order } from '../order/order.entity';
import { BillingModule } from '../billing/billing.module';
import { GenerationService } from './generation.service';
import { GenerationProcessor } from '../queue/generation.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    BullModule.registerQueue({
      name: 'generation',
    }),
    forwardRef(() => BillingModule),
  ],
  providers: [GenerationService, GenerationProcessor],
  exports: [GenerationService, BullModule],
})
export class GenerationModule {}
