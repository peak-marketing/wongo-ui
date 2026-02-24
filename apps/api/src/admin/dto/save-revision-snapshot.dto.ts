import { IsOptional, IsString } from 'class-validator';

export class SaveRevisionSnapshotDto {
  @IsOptional()
  @IsString()
  adminMemo?: string;

  @IsOptional()
  @IsString()
  revisionMemo?: string;
}
