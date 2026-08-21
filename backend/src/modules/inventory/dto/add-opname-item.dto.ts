import { IsUUID } from 'class-validator';

export class AddOpnameItemDto {
  @IsUUID()
  productId!: string;
}
