import { PartialType } from '@nestjs/mapped-types';
import { CreateUnitDto } from './create-unit.dto';

/**
 * Update Unit DTO
 * All fields from CreateUnitDto are optional
 */
export class UpdateUnitDto extends PartialType(CreateUnitDto) {}
