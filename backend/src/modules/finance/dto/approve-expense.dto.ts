import { IsOptional } from 'class-validator';

export class ApproveExpenseDto {
  @IsOptional()
  notes?: string;
}

