import { PartialType } from '@nestjs/mapped-types';
import { CreateColorDto } from './create-color.dto';

/**
 * Update Color DTO
 * All fields from CreateColorDto are optional
 */
export class UpdateColorDto extends PartialType(CreateColorDto) {}
