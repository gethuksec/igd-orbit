import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * List Expeditions DTO
 * Validates query parameters for expedition listing
 */
export class ListExpeditionsDto {
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  @IsOptional()
  limit?: number = 20;

  @IsString({ message: 'Search must be a string' })
  @IsOptional()
  search?: string; // Search by name, code

  @Type(() => Boolean)
  @IsOptional()
  includeInactive?: boolean; // If true, show all records including inactive

  @IsString()
  @IsOptional()
  status?: 'all' | 'active' | 'inactive'; // Filter by status
}
