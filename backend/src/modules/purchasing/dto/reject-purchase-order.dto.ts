import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectPurchaseOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
