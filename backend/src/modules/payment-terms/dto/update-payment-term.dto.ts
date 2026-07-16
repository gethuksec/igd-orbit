import { PartialType } from '@nestjs/mapped-types';
import { CreatePaymentTermDto } from './create-payment-term.dto';

/**
 * Update Payment Term DTO
 * All fields from CreatePaymentTermDto are optional
 */
export class UpdatePaymentTermDto extends PartialType(CreatePaymentTermDto) {}
