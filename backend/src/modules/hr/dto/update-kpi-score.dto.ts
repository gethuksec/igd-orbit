import { IsNumber, Min, Max } from 'class-validator';

export class UpdateKPIScoreDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  overall_score!: number;
}

