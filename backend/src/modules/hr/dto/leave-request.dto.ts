import {
  IsEnum,
  IsDateString,
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

  @IsNotEmpty()
  @IsString()
  reason!: string;

  @IsOptional()
  @IsUrl()
  attachment_url?: string;
}

