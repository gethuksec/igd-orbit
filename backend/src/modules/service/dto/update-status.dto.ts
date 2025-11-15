import {
  IsEnum,
  IsOptional,
  IsArray,
  IsString,
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
}



