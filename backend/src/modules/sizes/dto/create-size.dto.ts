import { IsOptional, IsNotEmpty, IsString } from 'class-validator';
export class CreateSizeDto {
  @IsString() @IsOptional() code?: string;
  @IsString() @IsNotEmpty({ message: 'Nama size harus diisi' }) name!: string;
}
