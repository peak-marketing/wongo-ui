import { Controller, Post, Body, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateReceiptReviewOrderDto } from './dto/create-receipt-review-order.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/user.entity';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Post()
  async create(@Body() dto: CreateOrderDto, @Req() req: any) {
    const user = req.user; // AGENCY
    const agencyId = user?.agencyId || user?.id;
    if (!agencyId) {
      const error = new BadRequestException('대행사 식별자가 필요합니다');
      console.error('[OrdersController.create] BadRequestException:', error.message);
      throw error;
    }

    // Validation은 DTO에서 처리되지만, 추가 검증
    if (!dto.place?.name?.trim()) {
      const error = new BadRequestException('플레이스명은 필수입니다');
      console.error('[OrdersController.create] BadRequestException:', error.message);
      throw error;
    }

    try {
      const userRecord = await this.userRepository.findOne({ where: { id: agencyId } });
      const defaultUnitPrice = userRecord?.defaultUnitPrice && userRecord.defaultUnitPrice > 0 ? userRecord.defaultUnitPrice : 0;
      const place = await this.ordersService.ensurePlace(agencyId, dto.place);
      const result = await this.ordersService.createOrder(agencyId, place.id, dto, defaultUnitPrice);
      console.log(`[OrdersController.create] Order created: ${result.id || result.ids?.join(',')}, status: ${result.status}`);
      return result;
    } catch (error) {
      console.error('[OrdersController.create] Error:', error.message || error);
      throw error;
    }
  }

  @Post('receipt-review')
  async createReceiptReview(@Body() dto: CreateReceiptReviewOrderDto, @Req() req: any) {
    const user = req.user; // AGENCY
    const agencyId = user?.agencyId || user?.id;
    if (!agencyId) {
      const error = new BadRequestException('대행사 식별자가 필요합니다');
      console.error('[OrdersController.createReceiptReview] BadRequestException:', error.message);
      throw error;
    }

    if (!String(dto.placeName || '').trim()) {
      const error = new BadRequestException('업체명은 필수입니다');
      console.error('[OrdersController.createReceiptReview] BadRequestException:', error.message);
      throw error;
    }

    if (!String(dto.extraInstruction || '').trim()) {
      const error = new BadRequestException('추가 지시문은 필수입니다');
      console.error('[OrdersController.createReceiptReview] BadRequestException:', error.message);
      throw error;
    }

    if (dto.mode === 'FIXED') {
      const fixed = Number(dto.fixedChars);
      if (!Number.isFinite(fixed) || fixed < 10 || fixed > 299) {
        throw new BadRequestException('FIXED 모드에서는 글자수(10~299)를 입력해주세요');
      }
    }

    try {
      const userRecord = await this.userRepository.findOne({ where: { id: agencyId } });
      const defaultUnitPrice = userRecord?.defaultUnitPrice && userRecord.defaultUnitPrice > 0 ? userRecord.defaultUnitPrice : 0;
      const result = await this.ordersService.createReceiptReviewOrder(agencyId, dto, defaultUnitPrice);
      console.log(`[OrdersController.createReceiptReview] Order created: ${result.id}, status: ${result.status}`);
      return result;
    } catch (error: any) {
      console.error('[OrdersController.createReceiptReview] Error:', error?.message || error);
      throw error;
    }
  }
}

