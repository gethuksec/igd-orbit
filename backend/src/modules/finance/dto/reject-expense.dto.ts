import { IsNotEmpty } from 'class-validator';

export class RejectExpenseDto {
  @IsNotEmpty()
  reason!: string;
}

