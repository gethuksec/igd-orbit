import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { LeaveTypesService } from './leave-types.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('LeaveTypesService (IGDERP-261)', () => {
  let service: LeaveTypesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      leaveType: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      leaveRequest: { count: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [LeaveTypesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<LeaveTypesService>(LeaveTypesService);
  });

  describe('findAll', () => {
    it('returns data + meta and filters inactive by default', async () => {
      prisma.leaveType.findMany.mockResolvedValue([{ id: '1', code: 'CUTI-TAHUNAN' }]);
      prisma.leaveType.count.mockResolvedValue(1);
      const res: any = await service.findAll({});
      expect(res.data).toHaveLength(1);
      expect(res.meta).toMatchObject({ total: 1, page: 1, limit: 20, totalPages: 1 });
      expect(prisma.leaveType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
      );
    });

    it('searches name and code case-insensitively', async () => {
      prisma.leaveType.findMany.mockResolvedValue([]);
      prisma.leaveType.count.mockResolvedValue(0);
      await service.findAll({ search: 'sakit' } as any);
      expect(prisma.leaveType.findMany.mock.calls[0][0].where.OR).toEqual([
        { name: { contains: 'sakit', mode: 'insensitive' } },
        { code: { contains: 'sakit', mode: 'insensitive' } },
      ]);
    });
  });

  describe('create', () => {
    it('auto-generates a code when omitted', async () => {
      prisma.leaveType.findUnique.mockResolvedValue(null);
      prisma.leaveType.findFirst.mockResolvedValue(null);
      prisma.leaveType.create.mockImplementation(async ({ data }: any) => ({ id: 'new', ...data }));
      const res: any = await service.create({ name: 'Cuti Tahunan' } as any);
      expect(res.code).toMatch(/^LVT-[0-9A-F]{8}$/);
    });

    it('rejects duplicate name', async () => {
      prisma.leaveType.findUnique.mockResolvedValue(null);
      prisma.leaveType.findFirst.mockResolvedValue({ id: 'x' });
      await expect(service.create({ code: 'CUTI-X', name: 'Cuti' } as any)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('delete', () => {
    it('blocks delete when leave requests reference the type', async () => {
      prisma.leaveType.findFirst.mockResolvedValue({ id: 'lt-1', code: 'CUTI-TAHUNAN' });
      prisma.leaveRequest.count.mockResolvedValue(3);
      await expect(service.delete('lt-1')).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.leaveType.update).not.toHaveBeenCalled();
    });

    it('soft-deletes an unused type', async () => {
      prisma.leaveType.findFirst.mockResolvedValue({ id: 'lt-1', code: 'CUTI-X' });
      prisma.leaveRequest.count.mockResolvedValue(0);
      prisma.leaveType.update.mockResolvedValue({});
      await service.delete('lt-1');
      expect(prisma.leaveType.update).toHaveBeenCalledWith({
        where: { id: 'lt-1' },
        data: { isActive: false, deletedAt: expect.any(Date) },
      });
    });

    it('throws NotFound for unknown id', async () => {
      prisma.leaveType.findFirst.mockResolvedValue(null);
      await expect(service.delete('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
