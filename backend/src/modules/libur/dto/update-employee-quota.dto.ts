import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * quotaDays null deletes the per-employee override (falls back to global).
 * Accepts explicit JSON null; undefined means "not provided".
 */
export class UpdateEmployeeQuotaDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(31)
  quotaDays?: number | null;
}
