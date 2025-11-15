import { IsNotEmpty, IsString } from 'class-validator';

export class CancelLeaveDto {
  @IsNotEmpty()
  @IsString()
  reason!: string;
}

