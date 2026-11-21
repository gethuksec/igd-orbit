import { IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

export class SetPayslipPinDto {
  @IsString()
  @Length(4, 12, { message: 'PIN must be 4-12 digits' })
  @Matches(/^[0-9]+$/, { message: 'PIN must contain digits only' })
  pin!: string;

  @IsOptional()
  @IsString()
  oldPin?: string;
}

export class UnlockPayslipDto {
  @IsString()
  @IsNotEmpty({ message: 'PIN is required' })
  pin!: string;
}
