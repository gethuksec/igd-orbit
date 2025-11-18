import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';

export class CreateServiceTypeDto {
  @IsString({ message: 'Code must be a string' })
  @IsOptional()
  code?: string;

  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  name!: string;

  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  description?: string;

  @IsNumber({}, { message: 'Base price must be a number' })
  @Min(0, { message: 'Base price must be greater than or equal to 0' })
  basePrice!: number;

  @IsNumber({}, { message: 'Min price must be a number' })
  @Min(0, { message: 'Min price must be greater than or equal to 0' })
  @IsOptional()
  minPrice?: number;

  @IsNumber({}, { message: 'Max price must be a number' })
  @Min(0, { message: 'Max price must be greater than or equal to 0' })
  @IsOptional()
  maxPrice?: number;

  @IsNumber({}, { message: 'SLA hours must be a number' })
  @Min(1, { message: 'SLA hours must be at least 1' })
  @Max(720, { message: 'SLA hours cannot exceed 720 (30 days)' })
  slaHours!: number;

  @IsBoolean({ message: 'isActive must be a boolean' })
  @IsOptional()
  isActive?: boolean = true;
}

