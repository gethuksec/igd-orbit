import { IsOptional, IsNotEmpty, IsString } from 'class-validator';
export class CreateSalesTypeDto {
  @IsString() @IsOptional() code?: string;
  @IsString() @IsNotEmpty({ message: 'Nama sales-type harus diisi' }) name!: string;
}
