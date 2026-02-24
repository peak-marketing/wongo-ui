import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class GenerateManuscriptDto {
	@IsOptional()
	@IsString()
	extraInstruction?: string;

	@IsOptional()
	@IsBoolean()
	autoRegen?: boolean;

	@IsOptional()
	@IsBoolean()
	qualityMode?: boolean;
}









