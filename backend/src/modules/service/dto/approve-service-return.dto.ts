import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ResolutionType } from './create-service-return.dto';

export class ApproveServiceReturnDto {
  @IsOptional()
  @IsString()
  resolution?: string;

  @IsOptional()
  @IsString()
  @IsEnum(ResolutionType)
  resolutionType?: ResolutionType;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectServiceReturnDto {
  @IsString()
  rejectionReason!: string;
}

