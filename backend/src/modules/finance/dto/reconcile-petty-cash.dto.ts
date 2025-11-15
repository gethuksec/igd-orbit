import { IsNumber, Min, IsOptional } from 'class-validator';

export class ReconcilePettyCashDto {
  @IsNumber()
  @Min(0)
  physical_count!: number;

  @IsOptional()
  variance_explanation?: string;
}

