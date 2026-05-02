import { IsArray, IsString } from 'class-validator';

export class UpdateMenuAccessDto {
  @IsArray()
  @IsString({ each: true })
  menuKeys!: string[];
}

