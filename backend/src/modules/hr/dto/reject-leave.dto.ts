import { IsNotEmpty, IsString } from 'class-validator';

export class RejectLeaveDto {
  @IsNotEmpty()
  @IsString()
  reason!: string;
}

