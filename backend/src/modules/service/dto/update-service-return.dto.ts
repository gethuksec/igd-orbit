import { IsString, IsEnum, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ResolutionType } from './create-service-return.dto';

export class UpdateServiceReturnDto {
  @IsOptional()
  @IsString()
  returnReason?: string;

  @IsOptional()
  @IsString()
  customerComplaint?: string;

  @IsOptional()
  @IsString()
  resolution?: string;

  @IsOptional()
  @IsString()
  @IsEnum(ResolutionType)
  resolutionType?: ResolutionType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  refundAmount?: number;
}

