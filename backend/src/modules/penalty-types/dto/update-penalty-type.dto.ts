import { IsOptional, IsString, IsBoolean, IsInt, IsNumber, IsEnum } from 'class-validator';

export class UpdatePenaltyTypeDto {
  @IsString() @IsOptional() code?: string;
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() description?: string;
  @IsEnum(['fixed', 'percent-tier', 'flexible']) @IsOptional() calculation?: string;
  @IsNumber() @IsOptional() defaultAmount?: number;
  @IsOptional() tiers?: any;
  @IsInt() @IsOptional() priority?: number;
  @IsBoolean() @IsOptional() picScoped?: boolean;
  @IsString() @IsOptional() approverRole?: string;
  @IsBoolean() @IsOptional() linksHolidayWork?: boolean;
  @IsOptional() isActive?: boolean;
}
