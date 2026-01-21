import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, BadRequestException, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { AgencyService } from './agency.service';
import { CreateOrderDto as AgencyCreateOrderDto } from './dto/create-order.dto';
import { CreateOrderDto as OrdersCreateOrderDto } from '../orders/dto/create-order.dto';
import { ReviewOrderDto } from './dto/review-order.dto';
import { GetUser } from '../common/decorators/get-user.decorator';
import { OrdersService } from '../orders/orders.service';

@Controller('agency/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.AGENCY)
export class AgencyController {
  constructor(
    private agencyService: AgencyService,
    private ordersService: OrdersService,
  ) {}

  @Post()
  async create(@GetUser() user: any, @Body() createOrderDto: AgencyCreateOrderDto) {
    const order = await this.agencyService.create(user.id, createOrderDto);
    return this.agencyService.sanitizeForAgency(order);
  }

  @Get()
  async findAll(
    @GetUser() user: any,
    @Query('status') status?: string,
    @Query('q') query?: string,
    @Query('completedDate') completedDate?: string,
    @Query('page') page: string = '1',
    @Query('sort') sort?: string,
  ) {
    const agencyId = user.id || user.userId;
    const pageNumber = Number(page) || 1;
    return this.agencyService.findAll(agencyId, {
      status,
      query,
      completedDate,
      page: pageNumber < 1 ? 1 : pageNumber,
      sort,
    });
  }

  @Get(':id')
  async findOne(@GetUser() user: any, @Param('id') id: string) {
    const order = await this.agencyService.findOne(id, user.id);
    return this.agencyService.sanitizeForAgency(order);
  }

  @Get(':id/download-zip')
  async downloadDeliverableZip(
    @GetUser() user: any,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const agencyId = user.id || user.userId;
    const { stream, fileName } = await this.agencyService.createDeliverableZipStream(id, agencyId);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-store');

    return new StreamableFile(stream);
  }

  @Post(':id/submit')
  async submit(@GetUser() user: any, @Param('id') id: string) {
    const order = await this.agencyService.submit(id, user.id);
    return this.agencyService.sanitizeForAgency(order);
  }

  @Post(':id/review')
  async review(
    @GetUser() user: any,
    @Param('id') id: string,
    @Body() reviewDto: ReviewOrderDto,
  ) {
    const order = await this.agencyService.review(id, user.id, reviewDto);

    return reviewDto.decision === 'APPROVE'
      ? {
          message: '원고가 승인되었습니다',
          order: this.agencyService.sanitizeForAgency(order),
        }
      : {
          message: '재생성을 시작했습니다',
          order: this.agencyService.sanitizeForAgency(order),
        };
  }

  @Put(':id')
  async update(
    @GetUser() user: any,
    @Param('id') id: string,
    @Body() updateOrderDto: OrdersCreateOrderDto,
  ) {
    const agencyId = user.id || user.userId;
    const result = await this.ordersService.updateOrder(agencyId, id, updateOrderDto);
    return result;
  }

  @Post(':id/cancel')
  async cancel(
    @GetUser() user: any,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    const agencyId = user.id || user.userId;
    const trimmedReason = reason?.trim();

    if (!trimmedReason || trimmedReason.length < 10 || trimmedReason.length > 300) {
      throw new BadRequestException('취소 사유는 10자 이상 300자 이하로 입력해주세요');
    }

    const order = await this.agencyService.cancel(id, agencyId, trimmedReason);

    return {
      message: '작성 중단을 완료했습니다',
      order: this.agencyService.sanitizeForAgency(order),
    };
  }
}



