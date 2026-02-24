import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { BillingService } from './billing.service';

@Controller('admin/settlements')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminSettlementsController {
  constructor(private readonly billing: BillingService) {}

  @Get('kpi')
  async getKpi(@Query('ymd') ymd?: string) {
    const dateYmd = String(ymd || '').trim();
    return this.billing.getSettlementKpiAdmin(dateYmd || new Date().toISOString().slice(0, 10));
  }

  @Get('agencies')
  async listAgencies(@Query('q') q?: string) {
    const query = typeof q === 'string' ? q.trim() : '';
    return this.billing.listSettlementAgenciesAdmin(query || undefined);
  }

  @Get('by-agency')
  async byAgency(@Query('userId') userId?: string, @Query('range') range?: string) {
    const uid = String(userId || '').trim();
    const r = typeof range === 'string' ? range.trim() : undefined;
    return this.billing.getSettlementByAgencyAdmin(uid, r);
  }
}
