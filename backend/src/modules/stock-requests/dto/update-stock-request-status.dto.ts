import { IsIn, IsOptional, IsString } from 'class-validator';

export const STOCK_REQUEST_STATUSES = [
  'SUBMITTED',
  'APPROVED',
  'WAITING_FOR_PO',
  'CHECKOUT',
  'KEEP_RESERVED',
  'IN_TRANSIT',
  'RECEIVED',
  'REJECTED',
  'CANCELLED',
] as const;

export class UpdateStockRequestStatusDto {
  @IsString()
  @IsIn([...STOCK_REQUEST_STATUSES] as string[], {
    message: 'status tidak dikenal',
  })
  status!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  poNumber?: string;
}

export class RotateIntakeTokenDto {
  @IsString()
  branchId!: string;
}
