import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Same loose UUID as create-mutasi (live DB has legacy non-v4 ids). */
const ANY_UUID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export class SendMutasiLineDto {
  @Matches(ANY_UUID)
  itemId!: string;

  /** Qty actually put on the truck. Defaults to requested; may be lowered. */
  @IsNumber()
  @Min(0)
  @IsOptional()
  quantitySent?: number;
}

export class SendMutasiDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SendMutasiLineDto)
  @IsOptional()
  items?: SendMutasiLineDto[];
}

export class ReceiveMutasiLineDto {
  @Matches(ANY_UUID)
  itemId!: string;

  /** Qty arriving in good condition. Must be ≤ sent. */
  @IsNumber()
  @Min(0)
  quantityReceived!: number;

  /**
   * IGDERP-173: damaged units in this line. Must equal (sent − received)
   * when there is a shortfall — every missing unit is booked to bad stock
   * via an auto-created SODO mutasi (destination GOOD → central BAD).
   */
  @IsNumber()
  @Min(0)
  @IsOptional()
  damageQuantity?: number;

  /** WA photo reference for the damage evidence (link / file id). */
  @IsString()
  @IsOptional()
  damagePhotoUrl?: string;

  @IsString()
  @IsOptional()
  damageNotes?: string;
}

export class ReceiveMutasiDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveMutasiLineDto)
  items!: ReceiveMutasiLineDto[];
}
