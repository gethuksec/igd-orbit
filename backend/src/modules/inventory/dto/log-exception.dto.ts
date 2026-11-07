import { IsString, MaxLength } from 'class-validator';

/** IGDERP-234 (OP2): log an unknown-barcode scan attempt (never a count line). */
export class LogExceptionDto {
  @IsString()
  @MaxLength(64)
  barcode!: string;
}
