import { IsOptional, IsNotEmpty, IsString, IsBoolean, IsInt, Min, IsNumber, Matches } from 'class-validator';

export const HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateShiftDto {
  @IsString() @IsOptional() code?: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsString()
  @IsNotEmpty()
  @Matches(HH_MM_REGEX, { message: 'clockIn must be in HH:MM format' })
  clockIn!: string;
  @IsString()
  @IsNotEmpty()
  @Matches(HH_MM_REGEX, { message: 'clockOut must be in HH:MM format' })
  clockOut!: string;
  @IsBoolean() @IsOptional() overnight?: boolean;
  @IsInt() @Min(0) @IsOptional() lateToleranceMin?: number;
  @IsNumber() @Min(0) @IsOptional() breakHours?: number;
  @IsString() @IsOptional() color?: string;
  @IsBoolean() @IsOptional() isActive?: boolean;
}
