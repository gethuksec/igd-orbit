import {
  IsDateString,
  IsNotEmpty,
  IsString,
  IsUrl,
  IsOptional,
} from 'class-validator';

export class LeaveRequestDto {
  /**
   * Leave type master code (leave_types.code, e.g. 'CUTI-TAHUNAN').
   * Legacy strings ('annual','sick','emergency','unpaid') still accepted
   * and mapped server-side (IGDERP-261 transitional).
   */
  @IsString()
  @IsNotEmpty()
  leave_type!: string;

  @IsDateString()
  start_date!: string;

  @IsDateString()
  end_date!: string;

  @IsNotEmpty()
  @IsString()
  reason!: string;

  @IsOptional()
  @IsUrl()
  attachment_url?: string;
}
