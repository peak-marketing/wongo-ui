import { Controller, Post, Body, BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserStatus } from '../common/enums/user-status.enum';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  async signup(@Body() body: { 
    businessName: string;
    businessRegNo: string;
    email: string;
    password: string;
    displayName?: string;
  }) {
    if (!body.businessName || !body.businessRegNo || !body.email || !body.password) {
      throw new BadRequestException('사업자명, 사업자등록번호, 이메일, 비밀번호는 필수입니다');
    }

    if (body.password.length < 8 || body.password.length > 64) {
      throw new BadRequestException('비밀번호는 8자 이상 64자 이하여야 합니다');
    }
    
    const existingUser = await this.authService.findByEmail(body.email);
    if (existingUser) {
      throw new ConflictException('이미 등록된 이메일입니다');
    }
    
    await this.authService.register({
      businessName: body.businessName,
      businessRegNo: body.businessRegNo,
      email: body.email,
      password: body.password,
      displayName: body.displayName,
    });
    
    return { message: 'submitted' };
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    const user = await this.authService.findByEmail(body.email);
    
    if (!user) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');
    }

    // 비밀번호 확인
    const isPasswordValid = await this.authService.validatePassword(body.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');
    }

    // 승인 상태 확인
    if (user.status !== UserStatus.APPROVED) {
      if (user.status === UserStatus.PENDING) {
        throw new UnauthorizedException('승인 대기 중입니다. 어드민 승인 후 로그인 가능합니다');
      } else if (user.status === UserStatus.REJECTED) {
        throw new UnauthorizedException('회원가입이 거절되었습니다');
      }
    }

    const loginResult = await this.authService.login(user);
    return {
      accessToken: loginResult.access_token,
      access_token: loginResult.access_token,
      role: user.role,
      userId: user.id,
      agencyId: user.agencyId || null,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.displayName || user.name,
        agencyId: user.agencyId || null,
      },
    };
  }
}

