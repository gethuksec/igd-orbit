import { IsOptional, IsString } from 'class-validator';

export class RejectLiburRequestDto {
  @IsString() @IsOptional() reason?: string;
}
