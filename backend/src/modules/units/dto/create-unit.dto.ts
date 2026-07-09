import { IsOptional, IsNotEmpty, IsString } from 'class-validator';
export class CreateUnitDto {
  @IsString() @IsOptional() code?: string;
  @IsString() @IsNotEmpty({ message: 'Nama unit harus diisi' }) name!: string;
}
