import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AskAiDto {
  @IsString()
  assetId!: string;

  @IsString()
  question!: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxCitations?: number;

  @IsOptional()
  @IsIn(['strict', 'expanded'])
  mode?: 'strict' | 'expanded';
}
