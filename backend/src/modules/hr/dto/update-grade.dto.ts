import { IsOptional, IsString, IsBoolean, IsInt, Min, Max } from 'class-validator';

export class UpdateGradeDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsInt({ message: 'Rank must be an integer 1-6' })
  @Min(1)
  @Max(6)
  @IsOptional()
  rank?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
