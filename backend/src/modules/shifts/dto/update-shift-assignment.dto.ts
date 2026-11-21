import {
  IsString,
  IsOptional,
  IsArray,
  ArrayNotEmpty,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';

export class UpdateShiftAssignmentDto {
  @IsString() @IsOptional() employeeId?: string;
  @IsString() @IsOptional() shiftId?: string;
  @IsDateString() @IsOptional() startDate?: string;
  @IsDateString() @IsOptional() endDate?: string;
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  @IsOptional()
  weekdays?: number[];
  @IsString() @IsOptional() note?: string;
}
