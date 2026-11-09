import { IsOptional, IsString, IsInt, Min, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class ListLeaveTypesDto {
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page?: number = 1;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() limit?: number = 20;
  @IsString() @IsOptional() search?: string;
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean() @IsOptional() includeInactive?: boolean;
  @IsString() @IsOptional() status?: string;
}

