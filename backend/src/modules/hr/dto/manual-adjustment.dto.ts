import {
  IsUUID,
  IsOptional,
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsInt,
  IsDateString,
} from 'class-validator';

export class ManualAdjustmentDto {
  @IsUUID()
  attendance_id!: string;

  @IsOptional()
  @IsDateString()
  clock_in?: string;

  @IsOptional()
  @IsDateString()
  clock_out?: string;

  @IsNotEmpty()
  @IsString()
  reason!: string;

  @IsOptional()
  @IsBoolean()
  is_late?: boolean;

  @IsOptional()
  @IsInt()
  late_minutes?: number;
}

