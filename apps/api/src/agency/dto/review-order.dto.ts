import { IsEnum, IsString, IsOptional } from 'class-validator';
import { ReviewDecision } from '../../common/enums/review-decision.enum';

export class ReviewOrderDto {
  @IsEnum(ReviewDecision)
  decision: ReviewDecision;

  @IsString()
  @IsOptional()
  reason?: string;
}









