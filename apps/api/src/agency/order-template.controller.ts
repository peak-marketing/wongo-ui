import { Controller, Get, Post, Body, Query, UseGuards, BadRequestException, Res } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { GetUser } from '../common/decorators/get-user.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderTemplate } from './order-template.entity';

@Controller('agency/order-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.AGENCY)
export class OrderTemplateController {
  constructor(
    @InjectRepository(OrderTemplate)
    private templateRepository: Repository<OrderTemplate>,
  ) {}

  /**
   * 플레이스명 정규화: 앞뒤 공백 제거, 연속 공백 1개로 축약, 소문자 변환
   */
  private normalizePlaceName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  private normalizeStringArray(value: unknown, limit?: number): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    const sanitized = value
      .map((item) => (typeof item === 'string' ? item : String(item)))
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    return typeof limit === 'number' ? sanitized.slice(0, limit) : sanitized;
  }

  private sanitizeSnapshot(snapshot: any) {
    const hashtags = this.normalizeStringArray(snapshot?.hashtags, 5).map((tag) => tag.replace(/^#/, ''));

    return {
      address: typeof snapshot?.address === 'string' ? snapshot.address : '',
      searchKeywords: this.normalizeStringArray(snapshot?.searchKeywords),
      includeText: typeof snapshot?.includeText === 'string' ? snapshot.includeText : '',
      requiredKeywords: this.normalizeStringArray(snapshot?.requiredKeywords),
      emphasizeKeywords: this.normalizeStringArray(snapshot?.emphasizeKeywords),
      link: typeof snapshot?.link === 'boolean' ? snapshot.link : !!snapshot?.link,
      map: typeof snapshot?.map === 'boolean' ? snapshot.map : !!snapshot?.map,
      hashtag: typeof snapshot?.hashtag === 'boolean' ? snapshot.hashtag : true,
      hashtags,
      referenceText: typeof snapshot?.referenceText === 'string' ? snapshot.referenceText : '',
      notes: typeof snapshot?.notes === 'string' ? snapshot.notes : '',
    };
  }

  private async saveTemplateSnapshot(agencyId: string, placeName: string, snapshot: any) {
    const templateData = this.sanitizeSnapshot(snapshot);
    const placeNameNormalized = this.normalizePlaceName(placeName);

    const template = this.templateRepository.create({
      agencyId,
      placeName,
      placeNameNormalized,
      templateData,
    });

    const saved = await this.templateRepository.save(template);

    // 동일 업체(정규화 기준) 최신 5개만 유지
    const templates = await this.templateRepository.find({
      where: { agencyId, placeNameNormalized },
      order: { createdAt: 'DESC' },
    });

    if (templates.length > 5) {
      const toRemove = templates.slice(5);
      await this.templateRepository.remove(toRemove);
    }

    return saved;
  }

  @Post()
  async createTemplate(
    @GetUser() user: any,
    @Body() body: { placeName?: string; snapshot?: any },
  ) {
    const userId = user.id || user.userId;
    const placeName = body.placeName?.trim();

    if (!placeName) {
      throw new BadRequestException('placeName은 필수입니다');
    }

    if (!body.snapshot || typeof body.snapshot !== 'object') {
      throw new BadRequestException('snapshot 데이터가 필요합니다');
    }

    const saved = await this.saveTemplateSnapshot(userId, placeName, body.snapshot);

    return {
      id: saved.id,
      placeName: saved.placeName,
      createdAt: saved.createdAt,
    };
  }

  @Get()
  async getTemplates(
    @GetUser() user: any,
    @Query('place') placeName?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const userId = user.id || user.userId;
    const queryBuilder = this.templateRepository
      .createQueryBuilder('template')
      .where('template.agencyId = :agencyId', { agencyId: userId })
      .orderBy('template.createdAt', 'DESC')
      .limit(5);

    if (placeName) {
      const normalized = this.normalizePlaceName(placeName);
      queryBuilder.andWhere('template.placeNameNormalized = :normalized', { normalized });
    }

    const templates = await queryBuilder.getMany();

    if (!templates.length) {
      if (res) {
        res.status(204);
      }
      return;
    }

    const latest = templates[0];

    return {
      id: latest.id,
      placeName: latest.placeName,
      templateData: latest.templateData,
      createdAt: latest.createdAt,
    };
  }
}




