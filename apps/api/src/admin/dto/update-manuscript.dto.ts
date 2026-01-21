import { IsString } from 'class-validator';

export class UpdateManuscriptDto {
  @IsString()
  manuscript!: string;
}
