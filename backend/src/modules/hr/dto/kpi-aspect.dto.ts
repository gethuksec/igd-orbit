import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsInt,
  IsIn,
  Min,
  Max,
} from 'class-validator';

export class CreateAspectDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  interval_min?: number;

  @IsOptional()
  @IsNumber()
  interval_max?: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  weight!: number;

  @IsString()
  @IsIn(['FIXED', 'PERIOD'])
  target_type!: string;

  @IsOptional()
  @IsNumber()
  fixed_target?: number | null;

  @IsOptional()
  @IsBoolean()
  is_kolektif?: boolean;

  @IsOptional()
  @IsInt()
  sort_order?: number;
}

export class UpdateAspectDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsNumber()
  interval_min?: number;

  @IsOptional()
  @IsNumber()
  interval_max?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  weight?: number;

  @IsOptional()
  @IsString()
  @IsIn(['FIXED', 'PERIOD'])
  target_type?: string;

  @IsOptional()
  @IsNumber()
  fixed_target?: number | null;

  @IsOptional()
  @IsBoolean()
  is_kolektif?: boolean;

  @IsOptional()
  @IsInt()
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpsertConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  default_amount?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
