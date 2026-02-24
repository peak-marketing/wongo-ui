import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ReviewDecision } from '../../common/enums/review-decision.enum';

export class ReviewManuscriptDto {
  @IsEnum(ReviewDecision)
  decision: ReviewDecision;

  @IsInt()
  @Min(1)
  @IsOptional()
  unitPrice?: number;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  extraInstruction?: string;
}









