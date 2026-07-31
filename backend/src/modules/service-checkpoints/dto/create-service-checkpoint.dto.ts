import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';

export class CreateServiceCheckpointDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}
