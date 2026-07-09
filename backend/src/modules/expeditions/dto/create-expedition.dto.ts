import { IsOptional, IsNotEmpty, IsString } from 'class-validator';
export class CreateExpeditionDto {
  @IsString() @IsOptional() code?: string;
  @IsString() @IsNotEmpty({ message: 'Nama expedition harus diisi' }) name!: string;
}
