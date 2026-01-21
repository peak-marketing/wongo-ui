import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  UseGuards,
  Body,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import { User } from '../../user/user.entity';
import { RejectAgencyDto } from './dto/reject-agency.dto';

function sanitizeAgencyUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    businessName: user.businessName,
    businessRegNo: user.businessRegNo,
    displayName: user.displayName,
    name: user.name,
    contactName: user.contactName,
    phone: user.phone,
    companyName: user.companyName,
    refundBank: user.refundBank,
    refundHolder: user.refundHolder,
    refundAccount: user.refundAccount,
    contactPosition: user.contactPosition,
    contactPhone: user.contactPhone,
    businessAddress1: user.businessAddress1,
    businessAddress2: user.businessAddress2,
    businessZipCode: user.businessZipCode,
    integrationMemo: user.integrationMemo,
    slackWebhookUrl: user.slackWebhookUrl,
    notifyByEmail: user.notifyByEmail,
    notifyBySms: user.notifyBySms,
    notifyBySlack: user.notifyBySlack,
    agencyId: user.agencyId,
    approvedAt: user.approvedAt,
    rejectedReason: user.rejectedReason,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

@Controller('admin/agencies')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminAgenciesController {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Get()
  async list(
    @Query('status') status?: UserStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const pageNum = page ? Math.max(1, parseInt(String(page), 10)) : 1;
    const limitNum = limit ? Math.min(100, Math.max(1, parseInt(String(limit), 10))) : 20;
    const skip = (pageNum - 1) * limitNum;

    const statusValue = status ?? UserStatus.PENDING;
    if (!Object.values(UserStatus).includes(statusValue)) {
      throw new BadRequestException('유효하지 않은 status 값입니다');
    }

    const queryBuilder = this.userRepository.createQueryBuilder('user');

    queryBuilder.where('user.role = :role', { role: UserRole.AGENCY });
    queryBuilder.andWhere('user.status = :status', { status: statusValue });

    const [users, total] = await queryBuilder
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limitNum)
      .getManyAndCount();

    return {
      items: users.map((u) => ({
        id: u.id,
        email: u.email,
        contactName: u.contactName,
        phone: u.phone,
        createdAt: u.createdAt,
        status: u.status,
      })),
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    const user = await this.userRepository.findOne({ where: { id, role: UserRole.AGENCY } });
    if (!user) throw new NotFoundException('대행사를 찾을 수 없습니다');
    return { agency: sanitizeAgencyUser(user) };
  }

  @Patch(':id/approve')
  async approve(@Param('id') id: string) {
    const user = await this.userRepository.findOne({ where: { id, role: UserRole.AGENCY } });
    if (!user) throw new NotFoundException('대행사를 찾을 수 없습니다');

    if (user.status !== UserStatus.PENDING) {
      throw new ConflictException('PENDING 상태에서만 승인할 수 있습니다');
    }

    user.status = UserStatus.APPROVED;
    user.approvedAt = new Date();
    user.rejectedReason = null;

    await this.userRepository.save(user);
    return { agency: sanitizeAgencyUser(user) };
  }

  @Patch(':id/reject')
  async reject(@Param('id') id: string, @Body() dto: RejectAgencyDto) {
    const reason = dto?.reason?.trim();
    if (!reason) {
      throw new BadRequestException('반려 사유는 필수입니다');
    }

    const user = await this.userRepository.findOne({ where: { id, role: UserRole.AGENCY } });
    if (!user) throw new NotFoundException('대행사를 찾을 수 없습니다');

    if (user.status !== UserStatus.PENDING) {
      throw new ConflictException('PENDING 상태에서만 반려할 수 있습니다');
    }

    user.status = UserStatus.REJECTED;
    user.rejectedReason = reason;

    await this.userRepository.save(user);
    return { agency: sanitizeAgencyUser(user) };
  }
}
