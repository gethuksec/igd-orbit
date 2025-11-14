import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';

/**
 * Update Product DTO
 * All fields from CreateProductDto are optional
 */
export class UpdateProductDto extends PartialType(CreateProductDto) {}

