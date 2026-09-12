import { IsOptional, IsString, MaxLength } from 'class-validator';

// IGDERP-137: final kerusakan-tag mapping per layanan row — Ready only.
export class UpdateLayananDto {
  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Tag maksimal 500 karakter' })
  notes?: string;
}
