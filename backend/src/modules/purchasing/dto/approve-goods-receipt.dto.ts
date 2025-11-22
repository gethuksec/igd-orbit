import { IsOptional, IsString, IsEnum } from 'class-validator';

export class ApproveGoodsReceiptDto {
  @IsEnum(['passed', 'failed', 'partial'])
  @IsOptional()
  inspection_status?: string;

  @IsString()
  @IsOptional()
  inspection_notes?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

