import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { ReturnType } from './create-service-return.dto';

export class UpdateServiceReturnDto {
  @IsEnum(ReturnType)
  @IsOptional()
  returnType?: ReturnType;

  @IsString()
  @IsOptional()
  returnReason?: string;

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

