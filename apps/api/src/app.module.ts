import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import 'dotenv/config';
import { OrderModule } from './order/order.module';
import { AgencyModule } from './agency/agency.module';
import { AdminModule } from './admin/admin.module';
import { BillingModule } from './billing/billing.module';
import { AuthModule } from './auth/auth.module';
import { ValidationModule } from './validation/validation.module';
import { HealthModule } from './health/health.module';
import { AssetsModule } from './assets/assets.module';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // monorepo: `pnpm -C apps/api dev` (cwd=apps/api) 와 루트 실행(cwd=repo root) 모두 지원
      envFilePath: ['.env.local', '.env', '../../.env.local', '../../.env'],
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production', // 개발 모드에서만 자동 동기화
      migrationsRun: true,
    }),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`,
      },
    }),
    RedisModule.forRoot({
      config: {
        url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`,
      },
    }),
    AuthModule,
    OrderModule,
    AgencyModule,
    AdminModule,
    BillingModule,
    ValidationModule,
    HealthModule,
    AssetsModule,
    OrdersModule,
  ],
})
export class AppModule {}

