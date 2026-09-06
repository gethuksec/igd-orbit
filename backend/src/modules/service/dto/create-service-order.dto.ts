import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsArray,
  IsDateString,
  IsInt,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CompletenessItemDto {
  @IsString()
  @IsOptional()
  checkpointId?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsBoolean()
  checked!: boolean;

  @IsString()
  @IsOptional()
  conditionNote?: string;
}

export class ServicePartItemDto {
  @IsUUID()
  productId!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsString()
  @IsOptional()
  purchaseType?: string; // 'internal' | 'external'

  @IsInt()
  @Min(0)
  @IsOptional()
  warrantyDays?: number;

  // IGDERP-136 round 2: source gudang per part (cross-gudang cross-selling); omitted = order warehouse.
  // NOTE: @IsString (not @IsUUID) — warehouse ids are TEXT, not all RFC UUIDs (cf. service_orders.warehouseId).
  @IsString()
  @IsOptional()
  warehouseId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ServiceLayananItemDto {
  @IsUUID()
  serviceTypeId!: string;

  // Per-row Biaya from intake (master basePrice ditched); omitted = master basePrice fallback
  @IsNumber()
  @Min(0)
  @IsOptional()
  estimatedCost?: number;

  // Tagging — what damage/part this row maps to (persisted to service_order_layanans.notes)
  @IsString()
  @MaxLength(500)
  @IsOptional()
  notes?: string;
}

export class CreateServiceOrderDto {
  // Branch (T21: allow global roles to pick a branch explicitly)
  @IsUUID()
  @IsOptional()
  branchId?: string;

  // Customer info
  @IsUUID()
  @IsOptional()
  customerId?: string;

  @IsNotEmpty()
  customerName!: string;

  @Matches(/^(\+62|0)[0-9]{9,12}$/)
  customerPhone!: string;

  @IsString()
  @IsOptional()
  customerEmail?: string;

  @IsString()
  @IsOptional()
  customerSubdistrict?: string;

  // Device info
  @IsNotEmpty()
  @IsEnum(['handphone', 'laptop', 'tablet', 'other'])
  deviceType!: 'handphone' | 'laptop' | 'tablet' | 'other';

  @IsString()
  @IsOptional()
  deviceUnit?: string;

  @IsString()
  @IsOptional()
  deviceColor?: string;

  @IsString()
  @IsOptional()
  deviceSerial?: string;

  @IsString()
  @IsOptional()
  deviceImei?: string;

  @IsString()
  @IsOptional()
  devicePassword?: string; // Will be encrypted

  @IsString()
  @IsOptional()
  deviceCondition?: string;

  @IsOptional()
  accessoriesIncluded?: string[]; // Will be converted to JSON

  // Service info
  @IsEnum(['quick', 'inap'])
  @IsOptional()
  serviceSubType?: 'quick' | 'inap';

  @IsNotEmpty()
  complaint!: string;

  @IsString()
  @IsOptional()
  initialDiagnosis?: string;

  // IGDERP-136 v9: order warranty (Dalam Garansi checkbox + days input; schema default 30 applies when omitted)
  @IsInt()
  @Min(0)
  @IsOptional()
  warrantyDays?: number;

  @IsUUID()
  @IsOptional()
  serviceTypeId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  layananIds?: string[]; // IGDERP-136: multi-layanan POS-like rows

  // IGDERP-136 round 4: per-row cost + tag (preferred over bare layananIds when present)
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ServiceLayananItemDto)
  layananItems?: ServiceLayananItemDto[];

  @IsNumber()
  @IsOptional()
  @Min(0)
  estimatedCost?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  finalPrice?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  quotedPrice?: number;

  @IsEnum(['normal', 'urgent'])
  @IsOptional()
  priority?: 'normal' | 'urgent';

  // Dates
  @IsDateString()
  @IsOptional()
  promisedDate?: string;

  // IGDERP-136 v9: Tgl Terima as datetime (CS-settable; defaults to now)
  @IsDateString()
  @IsOptional()
  receivedDate?: string;

  @IsString()
  @IsOptional()
  customerNotes?: string;

  // IGDERP-136 detail round: catatan internal CS (timeline Receive; default 'Service order created')
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  internalNotes?: string;

  @IsUUID()
  @IsOptional()
  assignedTechnicianId?: string;

  // Smart Repair extension (E-BE2)
  @IsString()
  @IsOptional()
  warehouseId?: string;

  @IsBoolean()
  @IsOptional()
  taxPpn?: boolean;

  @IsBoolean()
  @IsOptional()
  taxIncPpn?: boolean;

  @IsBoolean()
  @IsOptional()
  taxPph22?: boolean;

  @IsBoolean()
  @IsOptional()
  taxPph23?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  downPayment?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  laborCost?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  otherCost?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ServicePartItemDto)
  parts?: ServicePartItemDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CompletenessItemDto)
  completenessItems?: CompletenessItemDto[];
}



