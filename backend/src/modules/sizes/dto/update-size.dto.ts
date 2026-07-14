import { PartialType } from '@nestjs/mapped-types';
import { CreateSizeDto } from './create-size.dto';

/**
 * Update Size DTO
 * All fields from CreateSizeDto are optional
 */
export class UpdateSizeDto extends PartialType(CreateSizeDto) {}
