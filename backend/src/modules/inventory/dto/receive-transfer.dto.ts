import {
  IsArray,
  IsUUID,
  IsInt,
  IsOptional,
  IsEnum,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReceivedItemDto {
  @IsUUID()
  itemId!: string;

  @IsInt()
  @Min(0)
  quantityReceived!: number;

  @IsEnum(['good', 'damaged', 'expired'])
  @IsOptional()
  condition?: 'good' | 'damaged' | 'expired';

  @IsOptional()
  notes?: string;
}

export class ReceiveTransferDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceivedItemDto)
  items!: ReceivedItemDto[];
}

