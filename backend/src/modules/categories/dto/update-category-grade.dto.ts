import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * IGDERP-317 — update a category grade (rename / recode / activate toggle).
 */
export class UpdateCategoryGradeDto {
  @IsOptional()
  @IsString({ message: 'Grade name must be a string' })
  @MaxLength(100, { message: 'Grade name must not exceed 100 characters' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Grade code must be a string' })
  @Matches(/^[A-Z0-9]{10}$/, { message: 'Grade code must be exactly 10 uppercase alphanumeric characters' })
  code?: string;

  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive?: boolean;
}
