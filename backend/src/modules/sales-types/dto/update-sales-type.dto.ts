import { PartialType } from '@nestjs/mapped-types';
import { CreateSalesTypeDto } from './create-sales-type.dto';

/**
 * Update Sales Type DTO
 * All fields from CreateSalesTypeDto are optional
 */
export class UpdateSalesTypeDto extends PartialType(CreateSalesTypeDto) {}
