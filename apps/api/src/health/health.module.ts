import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { GenerationModule } from '../generation/generation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([]),
    GenerationModule,
  ],
  controllers: [HealthController],
})
export class HealthModule {}









