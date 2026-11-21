import { IsInt, Min, Max } from 'class-validator';

export class UpdateGlobalQuotaDto {
  @IsInt() @Min(0) @Max(31) quotaDays!: number;
}
