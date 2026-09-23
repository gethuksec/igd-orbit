import { IsNotEmpty, IsString } from 'class-validator';

// IGDERP-171: void a mistaken payment — approver role asserted in service.
export class VoidPaymentDto {
  @IsString()
  @IsNotEmpty({ message: 'Alasan void wajib diisi' })
  reason!: string;
}
