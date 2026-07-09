import { PartialType } from '@nestjs/mapped-types';
import { CreateSalesTypeDto } from './create-sales-type.dto';
export class UpdateSalesTypeDto extends PartialType(CreateSalesTypeDto) {}
