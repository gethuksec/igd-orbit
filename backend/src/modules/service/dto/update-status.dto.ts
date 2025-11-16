import {
  IsEnum,
  IsOptional,
  IsArray,
  IsString,
  IsNumber,
  Min,
} from 'class-validator';

export class UpdateStatusDto {
  @IsEnum([
    'pending',
    'diagnosed',
    'quoted',
    'approved',
    'in-progress',
    'qc',
    'completed',
    'delivered',
    'cancelled',
  ])
  status!:
    | 'pending'
    | 'diagnosed'
    | 'quoted'
    | 'approved'
    | 'in-progress'
    | 'qc'
    | 'completed'
    | 'delivered'
    | 'cancelled';

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  photos?: string[];

  @IsNumber()
  @Min(0)
  @IsOptional()
  quotedPrice?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  customerApprovedPrice?: number;
}



