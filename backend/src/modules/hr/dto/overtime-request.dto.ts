import {
  IsDateString,
  IsNumber,
  Min,
  Max,
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class OvertimeRequestDto {
  @IsDateString()
  date!: string;

  @IsNumber()
  @Min(0)
  @Max(8)
  hours!: number;

  @IsNotEmpty()
  @IsString()
  reason!: string;
}

