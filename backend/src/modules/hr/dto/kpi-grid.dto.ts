import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
  IsArray,
} from 'class-validator';

class GridTargetDto {
  @IsUUID()
  aspectId!: string;

  @IsNumber()
  target!: number;
}

class GridKolektifDto {
  @IsUUID()
  aspectId!: string;

  @IsNumber()
  value!: number;
}

class GridScoreDto {
  @IsUUID()
  employeeId!: string;

  @IsUUID()
  aspectId!: string;

  @IsNumber()
  value!: number;
}

class GridNoteDto {
  @IsUUID()
  employeeId!: string;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class SaveGridDto {
  @IsInt()
  @Min(1)
  @Max(12)
  period_month!: number;

  @IsInt()
  @Min(2000)
  @Max(2100)
  period_year!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GridTargetDto)
  targets?: GridTargetDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GridKolektifDto)
  kolektif?: GridKolektifDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GridScoreDto)
  scores?: GridScoreDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GridNoteDto)
  notes?: GridNoteDto[];
}
