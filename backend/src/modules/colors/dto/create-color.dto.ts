import { IsOptional, IsNotEmpty, IsString } from 'class-validator';
export class CreateColorDto {
  @IsString() @IsOptional() code?: string;
  @IsString() @IsNotEmpty({ message: 'Nama warna harus diisi' }) name!: string;
  @IsString() @IsOptional() notes?: string;
}
