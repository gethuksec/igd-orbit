import { IsOptional, IsString } from 'class-validator';

export class ApprovePurchaseOrderDto {
  @IsString()
  @IsOptional()
  notes?: string;
}

