import {
  IsString,
  IsNotEmpty,
} from 'class-validator';

export class RejectServiceReturnDto {
  @IsString()
  @IsNotEmpty()
  rejectionReason!: string;
}

