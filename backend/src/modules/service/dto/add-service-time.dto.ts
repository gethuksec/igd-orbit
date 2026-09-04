import { IsString, IsOptional, IsNotEmpty, IsDateString } from 'class-validator';

export class AddServiceTimeDto {
  @IsString()
  @IsOptional()
  serviceTypeId?: string;

  @IsString({ message: 'Alasan must be a string' })
  @IsNotEmpty({ message: 'Alasan wajib diisi' })
  notes!: string;

  @IsDateString({}, { message: 'Estimasi baru must be a valid date' })
  newEstimatedAt!: string;
}
