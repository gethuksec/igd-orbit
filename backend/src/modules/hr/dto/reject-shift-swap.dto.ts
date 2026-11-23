import { IsNotEmpty, IsString } from 'class-validator';

export class RejectShiftSwapDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
