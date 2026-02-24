import { IsString, IsOptional, IsArray, IsBoolean, IsNotEmpty } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  placeName: string;

  @IsString()
  @IsOptional()
  placeAddress?: string;

  @IsString()
  @IsOptional()
  searchKeywords?: string;

  @IsString()
  @IsOptional()
  guideContent?: string;

  @IsArray()
  @IsOptional()
  requiredKeywords?: string[];

  @IsArray()
  @IsOptional()
  emphasisKeywords?: string[];

  @IsBoolean()
  @IsOptional()
  hasLink?: boolean;

  @IsBoolean()
  @IsOptional()
  hasMap?: boolean;

  @IsArray()
  @IsOptional()
  hashtags?: string[];

  @IsString()
  @IsOptional()
  referenceReviews?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @IsOptional()
  photos?: string[];
}





