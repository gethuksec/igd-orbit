import { IsArray, IsUUID, ArrayUnique, IsOptional } from 'class-validator';

/** IGDERP-234 (OP2): assign a counter — categoryIds omitted = whole session scope. */
export class AddAssignmentDto {
  @IsUUID()
  userId!: string;

  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  @IsOptional()
  categoryIds?: string[];
}
