import { Body, Controller, Get, Put, UseGuards, ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { AgencyProfileService } from '../profile/profile.service';
import { UpdateAgencyProfileDto } from './dto/update-agency-profile.dto';

@Controller('agency/me/profile')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.AGENCY)
export class AgencyMeController {
  constructor(private readonly profileService: AgencyProfileService) {}

  @Get()
  getProfile(@GetUser() user: any) {
    const userId = user?.id || user?.userId;
    return this.profileService.getProfile(userId);
  }

  @Put()
  updateProfile(
    @GetUser() user: any,
    @Body(new ValidationPipe({ whitelist: true, transform: true })) payload: UpdateAgencyProfileDto,
  ) {
    const userId = user?.id || user?.userId;
    return this.profileService.updateProfile(userId, payload);
  }
}
