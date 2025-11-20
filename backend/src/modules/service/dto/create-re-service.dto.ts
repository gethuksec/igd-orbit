import {
  IsString,
  IsOptional,
  IsEnum,
} from 'class-validator';

export enum Priority {
  NORMAL = 'normal',
  URGENT = 'urgent',
}

export class CreateReServiceDto {
  @IsString()
  @IsOptional()
  serviceTypeId?: string;

  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @IsString()
  @IsOptional()
  notes?: string;
}

