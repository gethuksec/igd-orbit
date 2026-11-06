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
  @IsOptional()
  physicalQuantity?: number;

  @IsEnum(['good', 'damaged', 'expired'])
  @IsOptional()
  condition?: 'good' | 'damaged' | 'expired';

  /**
   * IGDERP-234 (OP2): blind-count split quantities. One scan carries
   * GOOD/RUSAK/KADALUARSA qtys and fans out to one row per non-zero
   * condition. When omitted, physicalQuantity + condition apply as before.
   */
  @IsInt()
  @Min(0)
  @IsOptional()
  goodQuantity?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  damagedQuantity?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  expiredQuantity?: number;

  @IsOptional()
  notes?: string;

  /**
   * IGDERP-175: explicit correction (table edit / Draft SO). Without it,
   * re-recording a counted row is a 409 double-scan guard.
   */
  @IsOptional()
  force?: boolean;

  /**
   * IGDERP-236 (OP4): mandatory reason when force overwrites an already
   * counted row — stored in the append-only correction history.
   */
  @IsOptional()
  correctionReason?: string;

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

