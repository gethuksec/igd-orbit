import { IsOptional, IsString } from 'class-validator';

export class ApproveLeaveDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

