import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';

export enum ResolutionType {
  RE_SERVICE = 're-service',
  REFUND = 'refund',
  DISCOUNT = 'discount',
  REPLACEMENT = 'replacement',
}

export class ApproveServiceReturnDto {
  @IsEnum(ResolutionType)
  @IsNotEmpty()
  resolutionType!: ResolutionType;

  @IsString()
  @IsNotEmpty()
  resolution!: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  refundAmount?: number;
}

