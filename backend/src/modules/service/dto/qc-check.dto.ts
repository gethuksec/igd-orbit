import {
  IsEnum,
  IsOptional,
  IsArray,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TestResult {
  @IsString()
  testName!: string;

  @IsEnum(['pass', 'fail'])
  result!: 'pass' | 'fail';

  @IsString()
  @IsOptional()
  notes?: string;
}

export class QcCheckDto {
  @IsEnum(['pass', 'fail'])
  status!: 'pass' | 'fail';

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestResult)
  @IsOptional()
  testResults?: TestResult[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  photos?: string[];
}



