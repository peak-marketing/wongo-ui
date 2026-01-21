import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RedisService } from '@liaoliaots/nestjs-redis';

@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    @InjectQueue('generation') private readonly genQueue: Queue,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  async check() {
    const dbCheck = await this.dataSource.query('SELECT 1').then(() => true).catch(() => false);
    const redisClient = this.redisService.getOrNil();
    const redisCheck = redisClient ? await redisClient.ping().then(res => res === 'PONG').catch(() => false) : false;
    const queueCounts = await this.genQueue.getJobCounts('waiting', 'active', 'failed', 'completed', 'delayed');

    return {
      ok: dbCheck && redisCheck,
      db: dbCheck,
      redis: redisCheck,
      queue: queueCounts,
    };
  }
}

