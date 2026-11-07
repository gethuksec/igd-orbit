import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, ValidateIf } from 'class-validator';

/**
 * Kecamatan list for Jember (outlet territory).
 * Keep in sync with frontend/src/data/kecamatan-jember.json.
 */
export const KECAMATAN_JEMBER = [
  'Ajung',
  'Ambulu',
  'Arjasa',
  'Balung',
  'Bangsalsari',
  'Gumukmas',
  'Jelbuk',
  'Jenggawah',
  'Jombang',
  'Kalisat',
  'Kaliwates',
  'Kencong',
  'Ledokombo',
  'Mayang',
  'Mumbulsari',
  'Pakusari',
  'Panti',
  'Patrang',
  'Puger',
  'Rambipuji',
  'Semboro',
  'Silo',
  'Sukorambi',
  'Sukowono',
  'Sumberbaru',
  'Sumberjambe',
  'Sumbersari',
  'Tanggul',
  'Tempurejo',
  'Umbulsari',
  'Wuluhan',
] as const;

export const INTAKE_WA_PATTERN = /^(\+62|0)[0-9]{9,12}$/;

/** Public quick-add: creates a retail Customer master row from the intake link. */
export class QuickAddIntakeCustomerDto {
  @IsString()
  @IsNotEmpty({ message: 'Nama wajib diisi.' })
  name!: string;

  @IsOptional()
  @IsString()
  @ValidateIf((o) => (o.phone ?? '').trim() !== '')
  @Matches(INTAKE_WA_PATTERN, {
    message: 'No. WA tidak valid. Format: 08… atau +62…',
  })
  phone?: string;

  @IsString()
  @IsNotEmpty({ message: 'Kecamatan wajib diisi.' })
  @IsIn(KECAMATAN_JEMBER as unknown as string[], {
    message: 'Kecamatan tidak valid.',
  })
  subdistrict!: string;
}

/** Backwards-compat intake payload: customerId preferred, customerType/memberRef still accepted. */
export class IntakeCustomerRefDto {
  @IsOptional()
  @IsUUID('4', { message: 'customerId must be a valid UUID' })
  customerId?: string;
}
