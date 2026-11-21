import { IsOptional, IsString, IsInt, Min, Max, Matches, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class ListLiburRequestsDto {
  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'period must be YYYY-MM' })
  period?: string;

  @IsString() @IsOptional() @IsIn(['pending', 'approved', 'rejected', 'cancelled']) status?: string;

  @IsString() @IsOptional() @IsIn(['current', 'advance']) kind?: string;

  @IsString() @IsOptional() search?: string;

  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page?: number = 1;

  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional() limit?: number = 20;
}
