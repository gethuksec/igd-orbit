import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/** S5: label template / printer settings (single active profile for the scaffold). */
export class UpdateLabelSettingDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(300)
  labelWidthMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(300)
  labelHeightMm?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  columns?: number;

  @IsOptional()
  @IsIn(['BARCODE', 'QR'])
  symbology?: string;

  @IsOptional()
  @IsIn(['THERMAL', 'A4'])
  paperType?: string;

  @IsOptional()
  @IsBoolean()
  showPrintedName?: boolean;

  @IsOptional()
  @IsBoolean()
  showPrice?: boolean;

  @IsOptional()
  @IsBoolean()
  showSku?: boolean;

  @IsOptional()
  @IsBoolean()
  autoPrint?: boolean;
}

/** S5: mark queued label jobs as printed after the browser print sheet runs. */
export class MarkLabelsPrintedDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}
