import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AssignPersonaDto {
  @IsString()
  @IsNotEmpty()
  personaId: string;

  @IsString()
  @IsOptional()
  personaSnapshot?: string;
}





