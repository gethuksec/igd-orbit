import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { ApprovalSettingsService } from './approval-settings.service';

describe('ApprovalSettingsService (IGDERP-80)', () => {
  let service: ApprovalSettingsService;
  let prisma: {
    approvalSetting: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      approvalSetting: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'as-1', category: 'GOODS_RECEIPT' }),
        update: jest.fn().mockResolvedValue({ id: 'as-1', category: 'GOODS_RECEIPT' }),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApprovalSettingsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<ApprovalSettingsService>(ApprovalSettingsService);
  });

  it('returns both categories with defaults when no rows exist', async () => {
    const all = await service.findAll();
    expect(all).toHaveLength(2);
    expect(all.map((r) => r.category)).toEqual(['PURCHASE_INVOICE', 'GOODS_RECEIPT']);
    expect(all.every((r) => r.roles.length === 0 && r.mandatoryInvoice === false && r.configured === false)).toBe(true);
  });

  it('assertApprover: default roles accept SUPERADMIN/HS/SPV/CSO/OWNER', async () => {
    await expect(service.assertApprover('GOODS_RECEIPT', 'u1', ['SUPERADMIN'])).resolves.toBeTruthy();
    await expect(service.assertApprover('GOODS_RECEIPT', 'u1', ['HS'])).resolves.toBeTruthy();
    await expect(service.assertApprover('GOODS_RECEIPT', 'u1', ['OWNER'])).resolves.toBeTruthy();
    await expect(service.assertApprover('GOODS_RECEIPT', 'u1', ['ASA'])).rejects.toThrow(ForbiddenException);
  });

  it('assertApprover: configured userIds override roles', async () => {
    prisma.approvalSetting.findUnique.mockResolvedValue({ category: 'GOODS_RECEIPT', roles: ['CFO'], userIds: ['u-cso-1'], mandatoryInvoice: false });
    await expect(service.assertApprover('GOODS_RECEIPT', 'u-cso-1', ['ASA'])).resolves.toBeTruthy();
    await expect(service.assertApprover('GOODS_RECEIPT', 'u-other', ['CFO'])).rejects.toThrow(ForbiddenException);
  });

  it('assertApprover: configured roles restrict the default list', async () => {
    prisma.approvalSetting.findUnique.mockResolvedValue({ category: 'GOODS_RECEIPT', roles: ['CFO'], userIds: [], mandatoryInvoice: false });
    await expect(service.assertApprover('GOODS_RECEIPT', 'u1', ['CFO'])).resolves.toBeTruthy();
    await expect(service.assertApprover('GOODS_RECEIPT', 'u1', ['HS'])).rejects.toThrow(ForbiddenException);
  });

  it('upsert creates then updates', async () => {
    await service.upsert({ category: 'GOODS_RECEIPT', roles: ['CFO'] }, 'admin-1');
    expect(prisma.approvalSetting.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ roles: ['CFO'], mandatoryInvoice: false }) }),
    );
    prisma.approvalSetting.findUnique.mockResolvedValue({ category: 'GOODS_RECEIPT', roles: ['CFO'], userIds: [], mandatoryInvoice: true });
    await service.upsert({ category: 'GOODS_RECEIPT', roles: ['CFO', 'MGR'] }, 'admin-1');
    expect(prisma.approvalSetting.update).toHaveBeenCalled();
  });
});
