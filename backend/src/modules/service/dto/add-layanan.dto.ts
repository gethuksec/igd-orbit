import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class AddLayananDto {
  @IsString()
  @IsNotEmpty()
  serviceTypeId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
