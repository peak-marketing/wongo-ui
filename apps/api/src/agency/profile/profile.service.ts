import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/user.entity';
import { UpdateAgencyProfileSimpleDto } from './dto/update-agency-profile.dto';

@Injectable()
export class AgencyProfileService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async getProfile(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }
    return this.buildResponse(user);
  }

  async updateProfile(userId: string, dto: UpdateAgencyProfileSimpleDto) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }

    const contactName = dto.contactName.trim();
    const companyName = dto.companyName.trim();
    const formattedPhone = this.formatPhone(dto.phone);
    const formattedBizRegNo = this.formatBusinessRegNo(dto.businessRegNo);

  user.contactName = contactName;
  user.displayName = contactName;

  user.phone = formattedPhone;

    user.companyName = companyName;
    user.businessName = companyName;

    user.businessRegNo = formattedBizRegNo;

    user.refundBank = dto.refundBank ? dto.refundBank.trim() : null;
    user.refundHolder = dto.refundHolder ? dto.refundHolder.trim() : null;
    user.refundAccount = dto.refundAccount ? dto.refundAccount.trim() : null;

    const saved = await this.users.save(user);
    return this.buildResponse(saved);
  }

  private buildResponse(user: User) {
    return {
      email: user.email,
  contactName: user.contactName || user.displayName || '',
  phone: user.phone || '',
  companyName: user.companyName || user.businessName || '',
      businessRegNo: user.businessRegNo || '',
      refundBank: user.refundBank || null,
      refundHolder: user.refundHolder || null,
      refundAccount: user.refundAccount || null,
      updatedAt: user.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }

  private formatPhone(digits: string) {
    const cleaned = digits.replace(/[^0-9]/g, '');
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    if (cleaned.length === 11) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
    }
    throw new BadRequestException('연락처 형식이 올바르지 않습니다');
  }

  private formatBusinessRegNo(digits: string) {
    const cleaned = digits.replace(/[^0-9]/g, '');
    if (cleaned.length !== 10) {
      throw new BadRequestException('사업자등록번호 형식이 올바르지 않습니다');
    }
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5)}`;
  }
}
