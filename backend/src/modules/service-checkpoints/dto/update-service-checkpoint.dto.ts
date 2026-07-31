import { IsString, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';

export class UpdateServiceCheckpointDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}
