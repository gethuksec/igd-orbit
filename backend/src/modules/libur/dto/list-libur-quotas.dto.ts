import { IsOptional, IsString, IsInt, Min, Max, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class ListLiburQuotasDto {
  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'period must be YYYY-MM' })
  period?: string;

  @IsString() @IsOptional() search?: string;

  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page?: number = 1;

  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional() limit?: number = 20;
}
