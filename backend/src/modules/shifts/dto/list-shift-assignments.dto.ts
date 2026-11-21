import { IsOptional, IsString, IsInt, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class ListShiftAssignmentsDto {
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page?: number = 1;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() limit?: number = 20;
  @IsString() @IsOptional() employeeId?: string;
  @IsString() @IsOptional() shiftId?: string;
  @IsDateString() @IsOptional() activeOn?: string;
  @IsString() @IsOptional() search?: string;
}
