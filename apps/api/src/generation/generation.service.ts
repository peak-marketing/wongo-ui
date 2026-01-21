import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { BillingService } from '../billing/billing.service';
import { Order } from '../order/order.entity';
import { OrderStatus } from '../common/enums/order-status.enum';
import { OrderType } from '../common/enums/order-type.enum';

export type GenerateEnqueueOptions = {
  extraInstruction?: string;
  revisionReason?: string;
  personaSnapshot?: string;
  autoRegen?: boolean;
  qualityMode?: boolean;
};

@Injectable()
export class GenerationService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectQueue('generation')
    private generationQueue: Queue,
    private billingService: BillingService,
  ) {}

  private cleanModeTokens(raw: string | undefined): { mode: 'speed' | 'quality'; cleaned?: string } {
    const tokenQuality = '__GEN_MODE__=quality';
    const tokenSpeed = '__GEN_MODE__=speed';
    const input = typeof raw === 'string' ? raw : '';
    let mode: 'speed' | 'quality' = 'speed';
    if (input.includes(tokenQuality)) mode = 'quality';
    const cleaned = input
      .split(/\r?\n/)
      .filter((line) => {
        const t = String(line || '').trim();
        return t !== tokenQuality && t !== tokenSpeed;
      })
      .join('\n')
      .trim();
    return { mode, cleaned: cleaned.length > 0 ? cleaned : undefined };
  }

  async enqueueGenerate(orderId: string, options?: GenerateEnqueueOptions): Promise<{ order: Order; jobId: string; mode: 'speed' | 'quality' }> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const autoRegen = Boolean(options?.autoRegen);

    if (order.status === OrderStatus.GENERATING) {
      throw new ForbiddenException('Order is already generating');
    }

    // 기본적으로 ADMIN_INTAKE/REGEN_QUEUED/FAILED만 생성 대상으로 간주
    // 예외: autoRegen=true 인 경우 SUBMITTED(1차 수정요청 자동 재생성) 허용
    if (
      !(autoRegen && order.status === OrderStatus.SUBMITTED) &&
      order.status !== OrderStatus.ADMIN_INTAKE &&
      order.status !== OrderStatus.REGEN_QUEUED &&
      order.status !== OrderStatus.FAILED
    ) {
      throw new ForbiddenException('Order must be in ADMIN_INTAKE, REGEN_QUEUED, or FAILED status');
    }

    if (!String(order.personaSnapshot || '').trim()) {
      throw new BadRequestException('Persona not assigned');
    }

    const rawExtra = typeof options?.extraInstruction === 'string' ? options.extraInstruction : '';
    const cleanedMode = this.cleanModeTokens(rawExtra);

    const explicitQualityMode = options?.qualityMode;
    const mode: 'speed' | 'quality' =
      explicitQualityMode === true ? 'quality' : explicitQualityMode === false ? 'speed' : cleanedMode.mode;

    const finalExtraInstruction = cleanedMode.cleaned;

    const manuscriptsCount = order.manuscript ? 1 : 0;
    const baseJobId = `gen_${orderId}_v${manuscriptsCount + 1}`;
    let jobId = baseJobId;
    try {
      const existing = await this.generationQueue.getJob(jobId).catch(() => null);
      if (existing) {
        jobId = `${baseJobId}_r${Date.now()}`;
      }
    } catch {
      // ignore
    }

    const tsQueue = new Date().toISOString();
    let reserved = false;
    let queuedJob: any = null;

    try {
      if (!autoRegen) {
        const units = (() => {
          const raw = (order as any)?.payload?.outputCount;
          const n = Math.trunc(Number(raw));
          if (n === 5) return 5;
          if (n === 10) return 10;
          return 1;
        })();
        await this.billingService.reserve(orderId, units);
        reserved = true;
      }

      const photos = Array.isArray(order.photos) ? order.photos.filter(Boolean) : [];
      queuedJob = await this.generationQueue.add(
        'generate',
        {
          orderId,
          autoRegen,
          extraInstruction: finalExtraInstruction ?? '',
          revisionReason: typeof options?.revisionReason === 'string' ? options.revisionReason : '',
          personaSnapshot: String(options?.personaSnapshot || order.personaSnapshot || ''),
          mode,
          qualityMode: mode === 'quality',
          guideSnapshot: {},
          orderData: {
            placeName: order.placeName,
            placeAddress: order.placeAddress,
            searchKeywords: order.searchKeywords,
            guideContent: order.guideContent,
            requiredKeywords: order.requiredKeywords,
            emphasisKeywords: order.emphasisKeywords,
            hasLink: order.hasLink,
            hasMap: order.hasMap,
            hashtags: order.hashtags,
            referenceReviews: order.referenceReviews,
            photosCount: photos.length,
            photos,
          },
        },
        {
          jobId,
          attempts: parseInt(process.env.GEN_MAX_ATTEMPTS || '3', 10),
          backoff: {
            type: 'exponential',
            delay: parseInt(process.env.GEN_BACKOFF_MS || '2000', 10),
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      const state = typeof queuedJob?.getState === 'function'
        ? await queuedJob.getState().catch(() => 'unknown')
        : 'unknown';
      if (state === 'failed' || state === 'completed') {
        throw new BadRequestException(`큐 등록 불가 (job state=${state})`);
      }

      console.log(`(${tsQueue}) (QUEUE_ADD) (SUCCESS) (${orderId}|${jobId}|)`);

      const updatePayload: Partial<Order> = {
        status: OrderStatus.GENERATING,
        completedAt: null,
        lastFailureReason: null,
        geminiStatusKo: '호출대기중',
      };
      if (finalExtraInstruction) {
        updatePayload.extraInstruction = finalExtraInstruction;
      }

      try {
        await this.orderRepository.update(orderId, updatePayload);
        order.status = OrderStatus.GENERATING;
      } catch (e: any) {
        try {
          await queuedJob?.remove?.();
        } catch {
          // ignore
        }
        if (reserved && !autoRegen) {
          await this.billingService.release(orderId).catch(() => undefined);
        }
        throw e;
      }

      return { order, jobId, mode };
    } catch (e: any) {
      const errMsg = String(e?.message || e || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200);
      console.log(`(${tsQueue}) (QUEUE_ADD) (FAIL) (${orderId}|${jobId}|${errMsg})`);
      if (reserved && !autoRegen) {
        await this.billingService.release(orderId).catch(() => undefined);
      }
      if (e instanceof BadRequestException || e instanceof ForbiddenException || e instanceof NotFoundException) {
        throw e;
      }
      throw new BadRequestException(errMsg || '큐 등록 실패');
    }
  }
}
