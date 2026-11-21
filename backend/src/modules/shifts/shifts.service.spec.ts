import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { ShiftsService } from './shifts.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

describe('ShiftsService', () => {
  let service: ShiftsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      shift: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [ShiftsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<ShiftsService>(ShiftsService);
  });

  describe('generateCode / create', () => {
    it('auto-generates an SHF-XXXXXXXX code when omitted', async () => {
      prisma.shift.findUnique.mockResolvedValue(null);
      prisma.shift.findFirst.mockResolvedValue(null);
      prisma.shift.create.mockImplementation(async ({ data }: any) => ({ id: 'new', ...data }));
      const res: any = await service.create({ name: 'Pagi', clockIn: '08:00', clockOut: '17:00' } as any);
      expect(res.code).toMatch(/^SHF-[0-9A-F]{8}$/);
    });

    it('rejects duplicate code', async () => {
      prisma.shift.findUnique.mockResolvedValue({ id: 'x' });
      await expect(
        service.create({ code: 'SHF-DUP', name: 'Pagi', clockIn: '08:00', clockOut: '17:00' } as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects duplicate name', async () => {
      prisma.shift.findUnique.mockResolvedValue(null);
      prisma.shift.findFirst.mockResolvedValue({ id: 'x' });
      await expect(
        service.create({ name: 'Pagi', clockIn: '08:00', clockOut: '17:00' } as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('HH:MM validation', () => {
    it.each([
      ['25:00', '08:00'],
      ['08:00', '8pm'],
      ['ab:cd', '17:00'],
      ['08:60', '17:00'],
    ])('rejects clockIn=%s clockOut=%s', async (clockIn, clockOut) => {
      await expect(
        service.create({ name: 'Pagi', clockIn, clockOut } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.shift.create).not.toHaveBeenCalled();
    });

    it('rejects invalid HH:MM on update', async () => {
      prisma.shift.findFirst.mockResolvedValue({ id: 's-1', code: 'SHF-1', name: 'Pagi' });
      await expect(service.update('s-1', { clockIn: '99:99' } as any)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.shift.update).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns data + meta with activeAssignmentsCount and filters inactive by default', async () => {
      prisma.shift.findMany.mockResolvedValue([
        { id: '1', code: 'SHF-A', _count: { assignments: 3 } },
      ]);
      prisma.shift.count.mockResolvedValue(1);
      const res: any = await service.findAll({});
      expect(res.data).toHaveLength(1);
      expect(res.data[0].activeAssignmentsCount).toBe(3);
      expect(res.meta).toMatchObject({ total: 1, page: 1, limit: 20, totalPages: 1 });
      expect(prisma.shift.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
      );
    });

    it('searches name and code case-insensitively', async () => {
      prisma.shift.findMany.mockResolvedValue([]);
      prisma.shift.count.mockResolvedValue(0);
      await service.findAll({ search: 'pagi' } as any);
      expect(prisma.shift.findMany.mock.calls[0][0].where.OR).toEqual([
        { name: { contains: 'pagi', mode: 'insensitive' } },
        { code: { contains: 'pagi', mode: 'insensitive' } },
      ]);
    });
  });

  describe('update', () => {
    it('throws NotFound for unknown id', async () => {
      prisma.shift.findFirst.mockResolvedValue(null);
      await expect(service.update('nope', { name: 'X' } as any)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('soft-deletes the shift', async () => {
      prisma.shift.findFirst.mockResolvedValue({ id: 's-1', code: 'SHF-1' });
      prisma.shift.update.mockResolvedValue({});
      await service.delete('s-1');
      expect(prisma.shift.update).toHaveBeenCalledWith({
        where: { id: 's-1' },
        data: { isActive: false, deletedAt: expect.any(Date) },
      });
    });

    it('throws NotFound for unknown id', async () => {
      prisma.shift.findFirst.mockResolvedValue(null);
      await expect(service.delete('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
