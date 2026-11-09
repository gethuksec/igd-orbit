import { IsArray, IsUUID, ArrayUnique, IsOptional } from 'class-validator';

/** IGDERP-260: one member on SO creation — plain user, no category pick. */
export class StartAssignmentDto {
  @IsUUID()
  userId!: string;

  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  @IsOptional()
  categoryIds?: string[];
}
