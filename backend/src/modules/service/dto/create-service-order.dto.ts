import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  IsDateString,
  Matches,
  Min,
} from 'class-validator';

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
  customerAlternatePhone?: string;

  // Device info
  @IsNotEmpty()
  @IsEnum(['handphone', 'laptop', 'tablet', 'other'])
  deviceType!: 'handphone' | 'laptop' | 'tablet' | 'other';

  @IsString()
  @IsOptional()
  deviceBrand?: string;

  @IsString()
  @IsOptional()
  deviceModel?: string;

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
}



