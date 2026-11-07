import { IsArray, IsUUID, ArrayUnique } from 'class-validator';

/** IGDERP-234 (OP2): assign a counter to categories mid-session. */
export class AddAssignmentDto {
  @IsUUID()
  userId!: string;

  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  categoryIds!: string[];
}
