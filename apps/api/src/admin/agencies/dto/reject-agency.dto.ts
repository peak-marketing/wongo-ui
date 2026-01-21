import { IsNotEmpty, IsString } from 'class-validator';

export class RejectAgencyDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}
