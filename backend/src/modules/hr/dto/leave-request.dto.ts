import {
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  IsNotEmpty,
  IsString,
  IsUrl,
  IsOptional,
} from 'class-validator';

export class LeaveRequestDto {
  @IsEnum(['annual', 'sick', 'emergency', 'unpaid'])
  leave_type!: string;

  @IsDateString()
  start_date!: string;

  @IsDateString()
  end_date!: string;

  @IsInt()
  @Min(1)
  total_days!: number;

  @IsNotEmpty()
  @IsString()
  reason!: string;

  @IsOptional()
  @IsUrl()
  attachment_url?: string;
}

