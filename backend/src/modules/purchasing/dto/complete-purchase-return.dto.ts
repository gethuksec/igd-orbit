import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Completion of a purchase return: goods physically shipped back to the supplier. */
export class CompletePurchaseReturnDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
