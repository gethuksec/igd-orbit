import {
  IsArray,
  IsEnum,
  IsString,
  IsOptional,
} from 'class-validator';

export class UploadPhotosDto {
  @IsArray()
  @IsString({ each: true })
  photoUrls!: string[];

  @IsEnum(['intake', 'diagnosis', 'repair', 'completed'])
  photoType!: 'intake' | 'diagnosis' | 'repair' | 'completed';

  @IsString()
  @IsOptional()
  description?: string;
}



