import { IsUUID, IsOptional, IsString } from 'class-validator';

export class AssignTechnicianDto {
  @IsUUID()
  technicianId!: string;

  @IsString()
  @IsOptional()
  notes?: string;
}



