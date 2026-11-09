import { IsOptional, IsUUID } from 'class-validator';

/** IGDERP-260: remove a member — categoryId omitted = remove the user entirely. */
export class RemoveAssignmentDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;
}
