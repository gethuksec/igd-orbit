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
  Matches,
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

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateServiceOrderDto {
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

  @IsUUID()
  @IsOptional()
  serviceTypeId?: string;

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

  @IsString()
  @IsOptional()
  customerNotes?: string;

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



