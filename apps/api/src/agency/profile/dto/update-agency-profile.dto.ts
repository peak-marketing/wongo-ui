import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateAgencyProfileSimpleDto {
  @IsString({ message: '담당자 이름은 문자열이어야 합니다' })
  @Length(1, 30, { message: '담당자 이름은 1자 이상 30자 이하로 입력해주세요' })
  contactName: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/[^0-9]/g, '') : value))
  @Matches(/^\d{10,11}$/, { message: '연락처는 숫자 10~11자리로 입력해주세요' })
  phone: string;

  @IsString({ message: '사업자명은 문자열이어야 합니다' })
  @Length(1, 50, { message: '사업자명은 1자 이상 50자 이하로 입력해주세요' })
  companyName: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/[^0-9]/g, '') : value))
  @Matches(/^\d{10}$/, { message: '사업자등록번호는 숫자 10자리로 입력해주세요' })
  businessRegNo: string;

  @IsOptional()
  @IsString({ message: '은행명은 문자열이어야 합니다' })
  @Length(1, 30, { message: '은행명은 1자 이상 30자 이하로 입력해주세요' })
  refundBank?: string;

  @IsOptional()
  @IsString({ message: '예금주는 문자열이어야 합니다' })
  @Length(1, 30, { message: '예금주는 1자 이상 30자 이하로 입력해주세요' })
  refundHolder?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/[^0-9-]/g, '') : value))
  @Matches(/^[0-9-]{4,30}$/, {
    message: '계좌번호는 숫자와 하이픈으로 4~30자 이내로 입력해주세요',
  })
  refundAccount?: string;
}

