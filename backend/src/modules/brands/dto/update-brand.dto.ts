import { PartialType } from '@nestjs/mapped-types';
import { CreateBrandDto } from './create-brand.dto';

/**
 * Update Brand DTO
 * All fields from CreateBrandDto are optional
 */
export class UpdateBrandDto extends PartialType(CreateBrandDto) {}

