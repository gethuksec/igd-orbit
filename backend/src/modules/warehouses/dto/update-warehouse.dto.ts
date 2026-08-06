import { PartialType } from '@nestjs/mapped-types';
import { CreateWarehouseDto } from './create-warehouse.dto';

/**
 * Update Warehouse DTO
 * All fields optional — partial updates only
 */
export class UpdateWarehouseDto extends PartialType(CreateWarehouseDto) {}
