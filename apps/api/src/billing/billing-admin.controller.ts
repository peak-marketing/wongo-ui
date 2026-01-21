import { Body, Controller, Get, Param, Patch, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { BillingService } from './billing.service';

@Controller('admin/billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminBillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('ledger')
  async getLedger(
    @Query('limit') limit?: string,
    @Query('status') status?: 'ALL' | 'PENDING' | 'COMPLETED',
  ) {
    const n = limit === undefined ? 100 : Math.trunc(Number(limit));
    const s = status === 'PENDING' || status === 'COMPLETED' ? status : 'ALL';
    const items = await this.billing.listLedgerAdmin(n, s);
    return { items };
  }

  @Get('ledger/export')
  async exportLedger(
    @Res() res: Response,
    @Query('limit') limit?: string,
    @Query('status') status?: 'ALL' | 'PENDING' | 'COMPLETED',
  ) {
    const n = limit === undefined ? 100 : Math.trunc(Number(limit));
    const s = status === 'PENDING' || status === 'COMPLETED' ? status : 'ALL';
    const buffer = await this.billing.exportLedgerAdminXlsx(n, s);
    const filename = `원장내역_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(buffer);
  }

  @Patch('transactions/:id/approve')
  async approveTopup(@Param('id') id: string) {
    return this.billing.approveTopupTransactionAdmin(id);
  }

  @Patch('transactions/:id/reject')
  async rejectTopup(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.billing.rejectTopupTransactionAdmin(id, String(body?.reason || '').trim());
  }
}
