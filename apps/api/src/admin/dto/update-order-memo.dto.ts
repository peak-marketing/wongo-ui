import { IsOptional, IsString } from 'class-validator';

export class UpdateOrderMemoDto {
  @IsOptional()
  @IsString()
  adminMemo?: string;

  @IsOptional()
  @IsString()
  revisionMemo?: string;
}
