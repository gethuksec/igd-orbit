import {
  IsEnum,
  IsOptional,
  IsArray,
  IsString,
  IsNumber,
  Min,
} from 'class-validator';

// IGDERP-168: new status machine — pending → diagnosed → in-progress → qc → ready → done (+cancelled).
// Legacy quoted/approved/completed/delivered removed.
export class UpdateStatusDto {
  @IsEnum([
    'pending',
    'diagnosed',
    'in-progress',
    'qc',
    'cancelled',
    'ready',
    'done',
  ])
  status!:
    | 'pending'
    | 'diagnosed'
    | 'in-progress'
    | 'qc'
    | 'cancelled'
    | 'ready'
    | 'done';

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

  @IsNumber()
  @Min(0)
  @IsOptional()
  laborCost?: number;

  @IsNumber()
  @IsOptional()
  discountAmount?: number; // Diskon dalam rupiah

  @IsString()
  @IsOptional()
  promoCode?: string; // Kode promo/diskon
}
