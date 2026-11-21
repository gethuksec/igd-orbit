import { IsOptional, IsString, IsBoolean, IsInt, Min, IsNumber, Matches } from 'class-validator';
import { HH_MM_REGEX } from './create-shift.dto';

export class UpdateShiftDto {
  @IsString() @IsOptional() code?: string;
  @IsString() @IsOptional() name?: string;
  @IsString()
  @IsOptional()
  @Matches(HH_MM_REGEX, { message: 'clockIn must be in HH:MM format' })
  clockIn?: string;
  @IsString()
  @IsOptional()
  @Matches(HH_MM_REGEX, { message: 'clockOut must be in HH:MM format' })
  clockOut?: string;
  @IsBoolean() @IsOptional() overnight?: boolean;
  @IsInt() @Min(0) @IsOptional() lateToleranceMin?: number;
  @IsNumber() @Min(0) @IsOptional() breakHours?: number;
  @IsString() @IsOptional() color?: string;
  @IsBoolean() @IsOptional() isActive?: boolean;
}
