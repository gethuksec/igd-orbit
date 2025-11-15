import { IsInt, IsOptional, Min, Max, IsString } from 'class-validator';

export class CustomerFeedbackDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  @IsOptional()
  feedback?: string;
}



