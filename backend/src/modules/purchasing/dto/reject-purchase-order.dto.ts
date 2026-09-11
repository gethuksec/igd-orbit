import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectPurchaseOrderDto {
  /**
   * 8 Sep decision: rejection note is mandatory on PO reject.
   */
  @IsString()
  @IsNotEmpty({ message: 'Alasan penolakan wajib diisi' })
  @MaxLength(2000)
  reason!: string;
}
