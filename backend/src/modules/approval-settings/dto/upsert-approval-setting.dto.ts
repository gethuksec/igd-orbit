import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export const APPROVAL_CATEGORIES = ['PURCHASE_INVOICE', 'GOODS_RECEIPT'] as const;
export type ApprovalCategory = (typeof APPROVAL_CATEGORIES)[number];

/** Default approver roles when no setting row exists (current hardcoded behavior + admin bypass). */
export const DEFAULT_APPROVER_ROLES = ['SUPERADMIN', 'HS', 'SPV', 'CSO', 'OWNER'];

export class UpsertApprovalSettingDto {
  @IsIn(APPROVAL_CATEGORIES)
  category!: ApprovalCategory;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];

  @IsOptional()
  @IsBoolean()
  mandatoryInvoice?: boolean;
}
