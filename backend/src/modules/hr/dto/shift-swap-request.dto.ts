import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class ShiftSwapRequestDto {
  @IsUUID()
  target_employee_id!: string;

  @IsDateString()
  date!: string;

  @IsUUID()
  from_shift_id!: string;

  @IsUUID()
  to_shift_id!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
