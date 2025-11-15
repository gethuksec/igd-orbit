import {
  IsUUID,
  IsEnum,
  IsArray,
  IsOptional,
  ValidateNested,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TransferItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  quantityRequested!: number;

  @IsOptional()
  notes?: string;
}

export class CreateTransferDto {
  @IsUUID()
  fromBranchId!: string;

  @IsUUID()
  toBranchId!: string;

  @IsEnum(['regular', 'urgent'])
  transferType!: 'regular' | 'urgent';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferItemDto)
  items!: TransferItemDto[];

  @IsOptional()
  notes?: string;
}

