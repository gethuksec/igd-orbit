import { IsNotEmpty, IsString, IsDateString } from 'class-validator';

export class CreateLiburRequestDto {
  @IsString() @IsNotEmpty() employeeId!: string;

  @IsDateString() date!: string;
}
