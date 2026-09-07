import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { APPROVAL_CATEGORIES, ApprovalCategory, DEFAULT_APPROVER_ROLES, UpsertApprovalSettingDto } from './dto/upsert-approval-setting.dto';

@Injectable()
export class ApprovalSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** List both categories; missing rows are reported as defaults. */
  async findAll() {
    const rows = await this.prisma.approvalSetting.findMany();
    return APPROVAL_CATEGORIES.map((category) => {
      const row = rows.find((r) => r.category === category);
      return {
        category,
        roles: row?.roles ?? [],
        userIds: row?.userIds ?? [],
        mandatoryInvoice: row?.mandatoryInvoice ?? false,
        configured: !!row,
      };
    });
  }

  async upsert(dto: UpsertApprovalSettingDto, userId: string) {
    if (!APPROVAL_CATEGORIES.includes(dto.category)) {
      throw new BadRequestException('Invalid approval category');
    }
    const existing = await this.prisma.approvalSetting.findUnique({
      where: { category: dto.category },
    });
    if (!existing) {
      return this.prisma.approvalSetting.create({
        data: {
          category: dto.category,
          roles: dto.roles ?? [],
          userIds: dto.userIds ?? [],
          mandatoryInvoice: dto.mandatoryInvoice ?? false,
          updatedBy: userId,
        },
      });
    }
    return this.prisma.approvalSetting.update({
      where: { category: dto.category },
      data: {
        roles: dto.roles ?? existing.roles,
        userIds: dto.userIds ?? existing.userIds,
        mandatoryInvoice: dto.mandatoryInvoice ?? existing.mandatoryInvoice,
        updatedBy: userId,
      },
    });
  }

  /**
   * Resolve effective approver rules for a category and enforce against the caller.
   * Blank/absent row => default roles. userIds override roles when present.
   * Throws ForbiddenException when the user is not an approver.
   */
  async assertApprover(category: ApprovalCategory, userId: string, userRoles: string[]) {
    const row = await this.prisma.approvalSetting.findUnique({ where: { category } });
    const hasDefaultAuthority = DEFAULT_APPROVER_ROLES.some((r) => userRoles.includes(r));

    if (!row || (row.roles.length === 0 && row.userIds.length === 0)) {
      if (!hasDefaultAuthority) {
        throw new ForbiddenException(`You do not have authority to act on ${category.toLowerCase()}`);
      }
      return { kind: 'default' as const, roles: DEFAULT_APPROVER_ROLES, userIds: [] };
    }

    if (row.userIds.length > 0) {
      if (!row.userIds.includes(userId)) {
        throw new ForbiddenException('You are not in the configured approver list');
      }
      return { kind: 'users' as const, roles: row.roles, userIds: row.userIds };
    }

    const hasRole = row.roles.some((r) => userRoles.includes(r));
    if (!hasRole) {
      throw new ForbiddenException('You do not have authority to act on this document');
    }
    return { kind: 'roles' as const, roles: row.roles, userIds: [] };
  }

  /** Raw row (could be null) — used for the mandatory-invoice gate on approve. */
  async getRow(category: ApprovalCategory) {
    return this.prisma.approvalSetting.findUnique({ where: { category } });
  }
}
