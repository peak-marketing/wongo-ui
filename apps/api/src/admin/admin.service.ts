import { BadRequestException, ConflictException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../order/order.entity';
import { OrderStatus } from '../common/enums/order-status.enum';
import { ReviewDecision } from '../common/enums/review-decision.enum';
import { AssignPersonaDto } from './dto/assign-persona.dto';
import { GenerateManuscriptDto } from './dto/generate-manuscript.dto';
import { ReviewManuscriptDto } from './dto/review-manuscript.dto';
import { BillingService } from '../billing/billing.service';
import { ValidationService } from '../validation/validation.service';
import { GenerationService } from '../generation/generation.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private billingService: BillingService,
    private validationService: ValidationService,
    private generationService: GenerationService,
  ) {}

  async findAll(status?: OrderStatus): Promise<Order[]> {
    const where = status ? { status } : {};
    return this.orderRepository.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['agency'],
    });
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['agency'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Calculate validation report
    if (order.manuscript) {
      order.validationReport = JSON.stringify(
        this.validationService.validate(order)
      );
    }

    return order;
  }

  async getOrderWithValidation(id: string) {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['agency'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const validationReport = order.manuscript
      ? this.validationService.validate(order)
      : null;

    return {
      order,
      manuscript: order.manuscript ? { textHtml: order.manuscript.replace(/\n/g, '<br>') } : null,
      validationReport: validationReport ? {
        charCountValid: validationReport.characterCount.valid,
        charCount: validationReport.characterCount.value,
        hashtagCountValid: validationReport.hashtags.valid,
        hashtags: order.hashtags || [],
        missingKeywords: [
          ...(validationReport.requiredKeywords.missing || []),
          ...(validationReport.emphasisKeywords.missing || []),
        ],
        flagsReport: {
          link: {
            required: order.hasLink || false,
            found: validationReport.hasLink.found,
          },
          map: {
            required: order.hasMap || false,
            found: validationReport.hasMap.found,
          },
          hashtag: {
            required: (order.hashtags?.length || 0) > 0,
            found: validationReport.hashtags.valid,
          },
        },
      } : null,
    };
  }

  async assignPersona(id: string, assignDto: AssignPersonaDto): Promise<Order> {
    const order = await this.findOne(id);
    
    if (order.status !== OrderStatus.SUBMITTED) {
      throw new ForbiddenException('Order must be in SUBMITTED status');
    }

    order.status = OrderStatus.ADMIN_INTAKE;
    order.personaId = assignDto.personaId;
    order.personaSnapshot = assignDto.personaSnapshot || `Persona ${assignDto.personaId}`;
    
    return this.orderRepository.save(order);
  }

  async generate(id: string, generateDto?: GenerateManuscriptDto): Promise<Order> {
    await this.generationService.enqueueGenerate(id, {
      extraInstruction: generateDto?.extraInstruction,
      autoRegen: generateDto?.autoRegen,
      qualityMode: generateDto?.qualityMode,
    });

    return this.findOne(id);
  }

  async forceFail(id: string, reason?: string): Promise<void> {
    const order = await this.findOne(id);

    if (order.status !== OrderStatus.GENERATING) {
      throw new BadRequestException(`현재 상태(${order.status})에서는 강제 실패 처리를 할 수 없습니다`);
    }

    const trimmed = String(reason || '').trim();
    const message = trimmed ? `FORCE_FAIL: ${trimmed}` : 'FORCE_FAIL: stalled/forced by admin';

    order.status = OrderStatus.FAILED;
    order.completedAt = null;
    order.lastFailureReason = message.slice(0, 200);
    await this.orderRepository.save(order);

    await this.billingService.release(id).catch(() => undefined);
  }

  async startReview(id: string): Promise<Order> {
    const order = await this.findOne(id);
    
    if (order.status !== OrderStatus.GENERATED) {
      throw new ForbiddenException('Order must be in GENERATED status');
    }

    order.status = OrderStatus.ADMIN_REVIEW;
    return this.orderRepository.save(order);
  }

  async review(id: string, reviewDto: ReviewManuscriptDto): Promise<Order> {
    const order = await this.findOne(id);
    
    if (order.status !== OrderStatus.ADMIN_REVIEW) {
      throw new ForbiddenException('Order must be in ADMIN_REVIEW status');
    }

    if (reviewDto.decision === ReviewDecision.PASS) {
      order.status = OrderStatus.AGENCY_REVIEW;
      await this.orderRepository.save(order);
      return order;
    } else if (reviewDto.decision === ReviewDecision.FAIL || reviewDto.decision === ReviewDecision.REVISION) {
      order.status = reviewDto.decision === ReviewDecision.FAIL 
        ? OrderStatus.ADMIN_REJECTED 
        : OrderStatus.REVISION_REQUESTED;
      order.rejectionReason = reviewDto.reason;
      await this.orderRepository.save(order);

      // Queue regeneration
      order.status = OrderStatus.REGEN_QUEUED;
      order.extraInstruction = reviewDto.extraInstruction || reviewDto.reason || '';
      await this.orderRepository.save(order);

      // Trigger regeneration
      await this.generate(id, {
        extraInstruction: reviewDto.extraInstruction || reviewDto.reason,
        autoRegen: true,
      });

      return order;
    }

    throw new ForbiddenException('Invalid decision');
  }

  async markRejectedAndRelease(id: string): Promise<void> {
    const order = await this.findOne(id);

    // 상태를 ADMIN_REJECTED로 표시
    order.status = OrderStatus.ADMIN_REJECTED;
    order.completedAt = null;
    await this.orderRepository.save(order);

    // ✅ 예약 해제
    await this.billingService.release(id).catch(() => {
      // Silent fail for release
    });
  }

  async cancelByAdmin(id: string, _reason?: string): Promise<void> {
    const order = await this.findOne(id);

    if (order.status === OrderStatus.COMPLETE) {
      throw new BadRequestException('완료된 주문은 취소할 수 없습니다');
    }

    const cancelableStatuses: ReadonlySet<OrderStatus> = new Set([
      OrderStatus.DRAFT,
      OrderStatus.SUBMITTED,
      OrderStatus.ADMIN_INTAKE,
      OrderStatus.GENERATING,
      OrderStatus.GENERATED,
      OrderStatus.ADMIN_REVIEW,
      OrderStatus.AGENCY_REVIEW,
      OrderStatus.ADMIN_REJECTED,
      OrderStatus.AGENCY_REJECTED,
      OrderStatus.REVISION_REQUESTED,
      OrderStatus.REGEN_QUEUED,
      OrderStatus.FAILED,
      OrderStatus.CANCEL_REQUESTED,
      OrderStatus.CANCELED_BY_AGENCY,
      OrderStatus.CANCELED,
    ]);

    if (!cancelableStatuses.has(order.status)) {
      throw new ConflictException('주문을 취소할 수 없는 상태입니다');
    }

    order.status = OrderStatus.CANCELED;
    order.completedAt = null;
    await this.orderRepository.save(order);

    await this.billingService.release(id).catch(() => undefined);
  }

  async deleteOrder(id: string): Promise<void> {
    const order = await this.findOne(id);

    const deletableStatuses: ReadonlySet<OrderStatus> = new Set([
      OrderStatus.DRAFT,
      OrderStatus.SUBMITTED,
      OrderStatus.ADMIN_INTAKE,
      OrderStatus.ADMIN_REJECTED,
      OrderStatus.AGENCY_REJECTED,
      OrderStatus.REVISION_REQUESTED,
      OrderStatus.REGEN_QUEUED,
      OrderStatus.FAILED,
      OrderStatus.CANCEL_REQUESTED,
      OrderStatus.CANCELED_BY_AGENCY,
      OrderStatus.CANCELED,
    ]);

    if (!deletableStatuses.has(order.status)) {
      throw new BadRequestException(`현재 상태(${order.status})에서는 삭제할 수 없습니다`);
    }

    await this.billingService.release(id).catch(() => undefined);
    await this.orderRepository.softDelete(id);
  }
}

