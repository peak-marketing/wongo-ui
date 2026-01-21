import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

class PlaceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  mapLink?: string;
}

class GuideDto {
  @IsArray()
  @IsString({ each: true })
  searchKeywords: string[];

  @IsOptional()
  @IsString()
  includeText?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredKeywords?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  emphasizeKeywords?: string[];

  @IsOptional()
  @IsBoolean()
  link?: boolean;

  @IsOptional()
  @IsBoolean()
  map?: boolean;

  @IsOptional()
  @IsBoolean()
  hashtag?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hashtags?: string[];
}

export class CreateOrderDto {
  @ValidateNested()
  @Type(() => PlaceDto)
  place: PlaceDto;

  @ValidateNested()
  @Type(() => GuideDto)
  guide: GuideDto;

  @IsOptional()
  @IsString()
  referenceText?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  targetChars?: [number, number]; // 기본값: [1500, 2000]

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  photoLimits?: [number, number]; // 기본값: [15, 20]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[]; // 사진 URL 배열

  @IsOptional()
  @IsArray()
  photoMetas?: Array<{ url: string; width: number; height: number; sizeKb: number }>; // 사진 메타데이터

  @IsOptional()
  @IsBoolean()
  saveAsDraft?: boolean; // 임시 저장 여부

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  submitCount?: number; // 접수 수량 (기본 1, 최소 1, 최대 5)
}

