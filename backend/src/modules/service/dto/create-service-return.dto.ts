import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
} from 'class-validator';

export enum ReturnType {
  RE_SERVICE = 're-service',
  COMPLAINT = 'complaint',
  WARRANTY = 'warranty',
  COMBINATION = 'combination',
}

export class CreateServiceReturnDto {
  @IsString()
  @IsNotEmpty()
  serviceOrderId!: string;

  @IsEnum(ReturnType)
  @IsNotEmpty()
  returnType!: ReturnType;

  @IsString()
  @IsNotEmpty()
  returnReason!: string;

  @IsString()
  @IsOptional()
  customerComplaint?: string;

  @IsBoolean()
  @IsOptional()
  isWithinWarranty?: boolean;

  @IsBoolean()
  @IsOptional()
  isWithinReturnPeriod?: boolean;
}

