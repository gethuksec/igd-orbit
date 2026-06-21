import { PartialType } from "@nestjs/mapped-types";
import { CreateCustomerTierDto } from "./create-customer-tier.dto";

/**
 * Update CustomerTier DTO
 * All fields from CreateCustomerTierDto are optional
 */
export class UpdateCustomerTierDto extends PartialType(CreateCustomerTierDto) {}
