import { PartialType } from '@nestjs/mapped-types';
import { CreateExpeditionDto } from './create-expedition.dto';

/**
 * Update Expedition DTO
 * All fields from CreateExpeditionDto are optional
 */
export class UpdateExpeditionDto extends PartialType(CreateExpeditionDto) {}
