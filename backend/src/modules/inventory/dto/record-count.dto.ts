import {
  IsArray,
  IsUUID,
  IsInt,
  IsOptional,
  IsEnum,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OpnameItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(0)
  physicalQuantity!: number;

  @IsEnum(['good', 'damaged', 'expired'])
  @IsOptional()
  condition?: 'good' | 'damaged' | 'expired';

  @IsOptional()
  notes?: string;

  /**
   * IGDERP-175: explicit correction (table edit / Draft SO). Without it,
   * re-recording a counted row is a 409 double-scan guard.
   */
  @IsOptional()
  force?: boolean;

  @IsUUID()
  @IsOptional()
  countedBy?: string;
}

export class RecordCountDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpnameItemDto)
  items!: OpnameItemDto[];
}

