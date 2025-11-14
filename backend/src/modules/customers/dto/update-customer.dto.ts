import { PartialType } from '@nestjs/mapped-types';
import { CreateCustomerDto } from './create-customer.dto';

/**
 * Update Customer DTO
 * All fields from CreateCustomerDto are optional
 */
export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}

