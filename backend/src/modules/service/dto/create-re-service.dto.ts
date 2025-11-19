import { IsString, IsOptional, IsDateString } from 'class-validator';

export class CreateReServiceDto {
  @IsOptional()
  @IsString()
  assignedTechnicianId?: string;

  @IsOptional()
  @IsDateString()
  promisedDate?: string; // ISO date string

  @IsOptional()
  @IsString()
  notes?: string;
}

