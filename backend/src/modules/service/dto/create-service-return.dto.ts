import { IsString, IsEnum, IsOptional, IsNumber, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum ReturnType {
  RE_SERVICE = 're-service',
  COMPLAINT = 'complaint',
  WARRANTY = 'warranty',
  COMBINATION = 'combination',
}

export enum ResolutionType {
  RE_SERVICE = 're-service',
  REFUND = 'refund',
  DISCOUNT = 'discount',
  REPLACEMENT = 'replacement',
}

export class CreateServiceReturnDto {
  @IsString()
  serviceOrderId!: string;

  @IsEnum(ReturnType)
  returnType!: ReturnType;

  @IsString()
  returnReason!: string;

  @IsOptional()
  @IsString()
  customerComplaint?: string;

  @IsOptional()
  @IsString()
  @IsEnum(ResolutionType)
  expectedResolution?: ResolutionType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  expectedRefundAmount?: number;

  @IsOptional()
  @IsDateString()
  returnedAt?: string; // ISO date string, default to now if not provided
}

