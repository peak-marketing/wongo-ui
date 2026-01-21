import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/user.entity';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminUsersController {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  @Get()
  async findAll(
    @Query('status') status?: UserStatus,
    @Query('query') query?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const pageNum = page ? Math.max(1, parseInt(String(page), 10)) : 1;
    const limitNum = limit ? Math.min(100, Math.max(1, parseInt(String(limit), 10))) : 20;
    const skip = (pageNum - 1) * limitNum;

    const queryBuilder = this.userRepository.createQueryBuilder('user');

    if (status) {
      queryBuilder.where('user.status = :status', { status });
    }

    if (query) {
      queryBuilder.andWhere(
        '(user.email LIKE :query OR user.businessName LIKE :query OR user.businessRegNo LIKE :query)',
        { query: `%${query}%` },
      );
    }

    const [users, total] = await queryBuilder
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limitNum)
      .getManyAndCount();

    return {
      users,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  @Post(':id/approve')
  async approve(
    @Param('id') id: string,
    @Body() body: { role?: UserRole },
  ) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new BadRequestException('사용자를 찾을 수 없습니다');
    }

    user.status = UserStatus.APPROVED;
    user.approvedAt = new Date();
    if (body.role && Object.values(UserRole).includes(body.role)) {
      user.role = body.role;
    }

    await this.userRepository.save(user);
    return { message: '승인 완료', user };
  }

  @Post(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new BadRequestException('사용자를 찾을 수 없습니다');
    }

    user.status = UserStatus.REJECTED;
    await this.userRepository.save(user);
    return { message: '거절 완료', user };
  }

  @Patch(':id/unit-price')
  async setDefaultUnitPrice(
    @Param('id') id: string,
    @Body() body: { unitPrice: number },
  ) {
    const unitPrice = Math.trunc(Number(body?.unitPrice));
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      throw new BadRequestException('unitPrice는 1 이상의 숫자여야 합니다');
    }

    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new BadRequestException('사용자를 찾을 수 없습니다');
    }

    if (user.role !== UserRole.AGENCY) {
      throw new BadRequestException('대행사(AGENCY) 계정만 단가를 설정할 수 있습니다');
    }

    if (user.status !== UserStatus.APPROVED) {
      throw new BadRequestException('승인된 대행사만 단가 설정이 가능합니다');
    }

    user.defaultUnitPrice = unitPrice;
    await this.userRepository.save(user);
    return { message: '단가 저장 완료', user };
  }
}









