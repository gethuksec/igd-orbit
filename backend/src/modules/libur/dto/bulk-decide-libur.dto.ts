import { ArrayNotEmpty, IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

/** IGDERP-265 Q5: HR ticks multiple queue rows → one approve/reject call (partial-fail safe). */
export class BulkDecideLiburDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  ids!: string[];

  @IsString()
  @IsOptional()
  reason?: string;
}
