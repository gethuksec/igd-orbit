import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  ArrayNotEmpty,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';

export class CreateShiftAssignmentDto {
  @IsString() @IsNotEmpty() employeeId!: string;
  @IsString() @IsNotEmpty() shiftId!: string;
  @IsDateString() startDate!: string;
  @IsDateString() @IsOptional() endDate?: string;
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  weekdays!: number[];
  @IsArray()
  @IsDateString({}, { each: true })
  @IsOptional()
  offDates?: string[];
  @IsString() @IsOptional() note?: string;
}
