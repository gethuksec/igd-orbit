import { IsNotEmpty, IsUUID, IsArray } from 'class-validator';

/**
 * Merge Customers DTO
 * Validates merge request payload
 */
export class MergeCustomersDto {
  @IsUUID('4', { message: 'Keep ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Keep ID is required' })
  keepId!: string; // Customer ID to keep

  @IsArray({ message: 'Remove IDs must be an array' })
  @IsUUID('4', { each: true, message: 'Each remove ID must be a valid UUID' })
  @IsNotEmpty({ message: 'At least one remove ID is required' })
  removeIds!: string[]; // Customer IDs to merge into keepId
}

