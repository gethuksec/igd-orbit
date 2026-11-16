import { IsNotEmpty, IsOptional, IsString, IsBoolean, IsInt, Min, Max } from 'class-validator';

export class CreateGradeDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsNotEmpty({ message: 'Grade name is required' })
  name!: string;

  @IsInt({ message: 'Rank must be an integer 1-6' })
  @Min(1)
  @Max(6)
  @IsNotEmpty({ message: 'Rank is required' })
  rank!: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
