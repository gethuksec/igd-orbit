import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * IGDERP-317 — create a grade inside a category scope.
 * Code is optional: empty submits auto-generate server-side (popup Generate
 * button mirrors the other masters). Names are unique per category.
 */
export class CreateCategoryGradeDto {
  @IsString({ message: 'Grade name must be a string' })
  @IsNotEmpty({ message: 'Grade name is required' })
  @MaxLength(100, { message: 'Grade name must not exceed 100 characters' })
  name!: string;

  @IsOptional()
  @IsString({ message: 'Grade code must be a string' })
  @Matches(/^[A-Z0-9]{10}$/, { message: 'Grade code must be exactly 10 uppercase alphanumeric characters' })
  code?: string;
}
