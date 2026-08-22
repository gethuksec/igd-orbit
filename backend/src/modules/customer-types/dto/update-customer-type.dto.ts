import { PartialType } from '@nestjs/mapped-types';
import { CreateCustomerTypeDto } from './create-customer-type.dto';

/**
 * Update Sales Type DTO
 * All fields from CreateCustomerTypeDto are optional
 */
export class UpdateCustomerTypeDto extends PartialType(CreateCustomerTypeDto) {}
