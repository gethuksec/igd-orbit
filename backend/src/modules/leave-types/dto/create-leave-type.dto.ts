import { IsOptional, IsNotEmpty, IsString, IsBoolean, IsInt, Min } from 'class-validator';

export class CreateLeaveTypeDto {
  @IsString() @IsOptional() code?: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsOptional() description?: string;
  @IsBoolean() @IsOptional() isPaid?: boolean;
  @IsInt() @Min(0) @IsOptional() quotaDays?: number;
  @IsInt() @Min(0) @IsOptional() maxApplyDelayDays?: number;
  @IsInt() @Min(1) @IsOptional() maxRequestsPerMonth?: number;
  @IsInt() @Min(0) @IsOptional() minTenureMonths?: number;
  @IsBoolean() @IsOptional() requiresAttachment?: boolean;
  @IsOptional() isActive?: boolean;
}
