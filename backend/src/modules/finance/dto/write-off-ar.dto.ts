import { IsNotEmpty, IsDateString, IsOptional } from 'class-validator';

export class WriteOffARDto {
  @IsNotEmpty()
  reason!: string;

  @IsDateString()
  @IsOptional()
  write_off_date?: string;
}

