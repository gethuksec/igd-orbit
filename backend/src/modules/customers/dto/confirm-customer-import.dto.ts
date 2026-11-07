import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Duplicate handling for import confirm: `overwrite` updates the existing
 * record, `skip` leaves it untouched (counted as skipped).
 */
export enum ImportDuplicateMode {
  Overwrite = 'overwrite',
  Skip = 'skip',
}

/**
 * One validated customer preview row for import confirm.
 * rowNumbers tracks the source Excel row(s); dateOfBirth is ISO yyyy-mm-dd
 * (converted from dd/mm/yyyy at preview).
 */
export class ConfirmCustomerImportRowDto {
  @IsArray({ message: 'Row numbers must be an array' })
  @IsInt({ each: true, message: 'Each row number must be an integer' })
  @Min(1, { each: true, message: 'Row number must be greater than zero' })
  rowNumbers!: number[];

  @IsString({ message: 'Customer code must be a string' })
  @IsOptional()
  customerCode?: string;

  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Customer name is required' })
  name!: string;

  @IsString({ message: 'Phone must be a string' })
  @IsNotEmpty({ message: 'Phone is required' })
  @Matches(/^(\+62|0)[0-9]{9,12}$/, {
    message: 'Phone must be in format: +62XXXXXXXXX or 0XXXXXXXXX (9-12 digits)',
  })
  phone!: string;

  @IsString({ message: 'Address must be a string' })
  @IsOptional()
  address?: string;

  @IsString({ message: 'Date of birth must be a string' })
  @IsOptional()
  dateOfBirth?: string;

  @IsIn(['L', 'P'], { message: 'Gender must be either L or P' })
  @IsOptional()
  gender?: string;

  @IsIn(['retail', 'wholesale', 'corporate'], {
    message: 'Customer type must be one of: retail, wholesale, corporate',
  })
  @IsOptional()
  customerType?: string;

  @IsString({ message: 'Notes must be a string' })
  @IsOptional()
  notes?: string;
}

/**
 * Confirm a previewed customer import.
 * Rows matching an existing customer (by phone or customerCode) are
 * updated; the rest are created via the standard create() path.
 */
export class ConfirmCustomerImportDto {
  @IsString({ message: 'File name must be a string' })
  @IsNotEmpty({ message: 'File name is required' })
  fileName!: string;

  @IsArray({ message: 'Rows must be an array' })
  @ValidateNested({ each: true })
  @Type(() => ConfirmCustomerImportRowDto)
  rows!: ConfirmCustomerImportRowDto[];

  @IsOptional()
  @IsEnum(ImportDuplicateMode, { message: 'duplicateMode must be either overwrite or skip' })
  duplicateMode?: 'overwrite' | 'skip' = ImportDuplicateMode.Overwrite;
}
