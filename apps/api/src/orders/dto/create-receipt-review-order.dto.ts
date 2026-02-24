import { IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateReceiptReviewOrderDto {
  @IsString()
  @IsNotEmpty()
  placeName: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['FIXED', 'RANDOM'])
  mode: 'FIXED' | 'RANDOM';

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(299)
  fixedChars?: number;

  @IsOptional()
  @IsString()
  menuName?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredKeywords?: string[];

  @IsOptional()
  @IsBoolean()
  emoji?: boolean;

  @IsOptional()
  @IsBoolean()
  qualityMode?: boolean;

  @IsOptional()
  @IsInt()
  @IsIn([1, 5, 10])
  outputCount?: 1 | 5 | 10;

  @IsString()
  @IsNotEmpty()
  extraInstruction: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  saveAsDraft?: boolean;
}
