import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * Create Sales Return DTO — IGDERP-85
 * Full-invoice return created from a Selesai (completed) transaction.
 */
export class CreateSalesReturnDto {
  @IsUUID('4', { message: 'transactionId must be a valid UUID' })
  transactionId!: string;

  @IsString({ message: 'Alasan retur harus berupa teks' })
  @IsNotEmpty({ message: 'Alasan retur wajib diisi' })
  @MaxLength(255, { message: 'Alasan retur maksimal 255 karakter' })
  reason!: string;

  @IsEnum(['cash', 'exchange'], {
    message: 'Penyelesaian harus salah satu dari: cash (Tunai), exchange (Tukar Barang)',
  })
  settlementType!: 'cash' | 'exchange';

  @IsOptional()
  @IsUUID('4', { message: 'coaId must be a valid UUID' })
  coaId?: string;
}
