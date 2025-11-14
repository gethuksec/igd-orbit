import { PartialType } from '@nestjs/mapped-types';
import { CreateCategoryDto } from './create-category.dto';

/**
 * Update Category DTO
 * All fields from CreateCategoryDto are optional
 */
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

