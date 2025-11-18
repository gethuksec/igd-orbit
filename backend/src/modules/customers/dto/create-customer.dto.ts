import {
  IsOptional,
  IsNotEmpty,
  IsString,
  IsEmail,
  IsEnum,
  IsUUID,
  IsNumber,
  Min,
  IsInt,
  IsDateString,
  Matches,
} from 'class-validator';

/**
 * Create Customer DTO
 * Validates customer creation request payload
 */
export class CreateCustomerDto {
  @IsString({ message: 'Customer code must be a string' })
  @IsOptional()
  customerCode?: string; // Auto-generate if not provided

  @IsEnum(['retail', 'wholesale', 'corporate'], {
    message: 'Customer type must be one of: retail, wholesale, corporate',
  })
  @IsNotEmpty({ message: 'Customer type is required' })
  customerType!: string;

  @IsUUID('4', { message: 'Tier ID must be a valid UUID' })
  @IsOptional()
  tierId?: string;

  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Customer name is required' })
  name!: string;

  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsOptional()
  email?: string;

  @IsString({ message: 'Phone must be a string' })
  @IsNotEmpty({ message: 'Phone is required' })
  @Matches(/^(\+62|0)[0-9]{9,12}$/, {
    message: 'Phone must be in format: +62XXXXXXXXX or 0XXXXXXXXX (9-12 digits)',
  })
  phone!: string;

  @IsString({ message: 'Alternate phone must be a string' })
  @Matches(/^(\+62|0)[0-9]{9,12}$/, {
    message: 'Alternate phone must be in format: +62XXXXXXXXX or 0XXXXXXXXX (9-12 digits)',
  })
  @IsOptional()
  alternatePhone?: string;

  @IsDateString({}, { message: 'Date of birth must be a valid date string' })
  @IsOptional()
  dateOfBirth?: string;

  @IsEnum(['L', 'P'], { message: 'Gender must be either L or P' })
  @IsOptional()
  gender?: string;

  @IsString({ message: 'Address must be a string' })
  @IsOptional()
  address?: string;

  @IsString({ message: 'Subdistrict must be a string' })
  @IsOptional()
  subdistrict?: string; // Kecamatan

  @IsString({ message: 'City must be a string' })
  @IsOptional()
  city?: string;

  @IsString({ message: 'Province must be a string' })
  @IsOptional()
  province?: string;

  @IsString({ message: 'Postal code must be a string' })
  @IsOptional()
  postalCode?: string;

  @IsString({ message: 'Country must be a string' })
  @IsOptional()
  country?: string;

  @IsString({ message: 'Religion must be a string' })
  @IsOptional()
  religion?: string; // Agama

  @IsString({ message: 'ID type must be a string' })
  @IsOptional()
  idType?: string; // Jenis Identitas (KTP, SIM, dll)

  @IsString({ message: 'ID number must be a string' })
  @IsOptional()
  idNumber?: string; // Nomor Identitas

  @IsString({ message: 'Tax ID must be a string' })
  @IsOptional()
  taxId?: string; // No NPWP/KTP

  @IsString({ message: 'Tax name must be a string' })
  @IsOptional()
  taxName?: string; // Nama (Pajak)

  @IsString({ message: 'Tax ID type must be a string' })
  @IsOptional()
  taxIdType?: string; // Jenis Identitas Pajak (NPWP/KTP)

  @IsString({ message: 'Tax address must be a string' })
  @IsOptional()
  taxAddress?: string; // Alamat (Pajak)

  @IsString({ message: 'IDTKU must be a string' })
  @IsOptional()
  idTKU?: string; // IDTKU

  @IsString({ message: 'Tax transaction detail must be a string' })
  @IsOptional()
  taxTransactionDetail?: string; // Detail Transaksi Pajak (01/02/03..dst)

  @IsNumber({}, { message: 'Credit limit must be a number' })
  @Min(0, { message: 'Credit limit must be greater than or equal to 0' })
  @IsOptional()
  creditLimit?: number; // Plafon Nilai

  @IsInt({ message: 'Credit limit note count must be an integer' })
  @Min(0, { message: 'Credit limit note count must be greater than or equal to 0' })
  @IsOptional()
  creditLimitNoteCount?: number; // Plafon Jumlah Nota

  @IsInt({ message: 'Payment term days must be an integer' })
  @Min(0, { message: 'Payment term days must be greater than or equal to 0' })
  @IsOptional()
  paymentTermDays?: number;

  @IsUUID('4', { message: 'Preferred branch ID must be a valid UUID' })
  @IsOptional()
  preferredBranchId?: string;

  @IsString({ message: 'Notes must be a string' })
  @IsOptional()
  notes?: string;
}

