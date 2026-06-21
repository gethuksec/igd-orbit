import {
  IsOptional,
  IsNotEmpty,
  IsString,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * Create CustomerTier DTO
 * Validates customer tier creation request payload
 */
export class CreateCustomerTierDto {
  @IsString({ message: "Code must be a string" })
  @IsOptional()
  code?: string; // Auto-generate if not provided

  @IsString({ message: "Name must be a string" })
  @IsNotEmpty({ message: "Customer tier name is required" })
  name!: string;

  @IsString({ message: "Description must be a string" })
  @IsOptional()
  description?: string;

  @IsNumber({}, { message: "Discount percentage must be a number" })
  @Min(0, { message: "Discount percentage must be at least 0" })
  @Max(100, { message: "Discount percentage must be at most 100" })
  @Type(() => Number)
  discountPercentage!: number;

  @IsNumber({}, { message: "Credit limit must be a number" })
  @Min(0, { message: "Credit limit must be at least 0" })
  @Type(() => Number)
  creditLimit!: number;

  @IsNumber({}, { message: "Minimum purchase amount must be a number" })
  @Min(0, { message: "Minimum purchase amount must be at least 0" })
  @IsOptional()
  @Type(() => Number)
  minPurchaseAmount?: number;

  @IsBoolean({ message: "isActive must be a boolean" })
  @IsOptional()
  isActive?: boolean;
}
