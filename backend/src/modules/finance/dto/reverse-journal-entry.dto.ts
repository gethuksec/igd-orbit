import { IsNotEmpty, IsOptional } from 'class-validator';

export class ReverseJournalEntryDto {
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  notes?: string;
}

