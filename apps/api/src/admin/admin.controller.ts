import { Controller, Get, Post, Body, Param, Query, UseGuards, Delete } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { AdminService } from './admin.service';
import { AssignPersonaDto } from './dto/assign-persona.dto';
import { GenerateManuscriptDto } from './dto/generate-manuscript.dto';
import { ReviewManuscriptDto } from './dto/review-manuscript.dto';
import { OrderStatus } from '../common/enums/order-status.enum';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('orders')
  async findAll(@Query('status') status?: OrderStatus) {
    return this.adminService.findAll(status);
  }

  @Get('orders/:id')
  async findOne(@Param('id') id: string) {
    return this.adminService.getOrderWithValidation(id);
  }

  @Post('orders/:id/assign-persona')
  async assignPersona(@Param('id') id: string, @Body() assignDto: AssignPersonaDto) {
    return this.adminService.assignPersona(id, assignDto);
  }

  @Post('orders/:id/generate')
  async generate(@Param('id') id: string, @Body() generateDto: GenerateManuscriptDto) {
    return this.adminService.generate(id, generateDto);
  }

  @Post('orders/:id/review')
  async review(@Param('id') id: string, @Body() reviewDto: ReviewManuscriptDto) {
    return this.adminService.review(id, reviewDto);
  }

  @Post('orders/:id/start-review')
  async startReview(@Param('id') id: string) {
    return this.adminService.startReview(id);
  }

  @Post('orders/:id/cancel')
  async cancel(@Param('id') id: string, @Body() body?: { reason?: string }) {
    await this.adminService.cancelByAdmin(id, body?.reason);
    return { ok: true };
  }

  @Post('orders/:id/force-fail')
  async forceFail(@Param('id') id: string, @Body() body?: { reason?: string }) {
    await this.adminService.forceFail(id, body?.reason);
    return { ok: true };
  }

  @Delete('orders/:id')
  async deleteOrder(@Param('id') id: string) {
    await this.adminService.deleteOrder(id);
    return { ok: true };
  }
}

