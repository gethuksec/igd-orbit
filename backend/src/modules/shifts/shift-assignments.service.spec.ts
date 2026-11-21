import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { ShiftAssignmentsService } from './shift-assignments.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

describe('ShiftAssignmentsService', () => {
  let service: ShiftAssignmentsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      employee: { findUnique: jest.fn() },
      shift: { findFirst: jest.fn() },
      shiftAssignment: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [ShiftAssignmentsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<ShiftAssignmentsService>(ShiftAssignmentsService);
  });

  const refsOk = () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1' });
    prisma.shift.findFirst.mockResolvedValue({ id: 'sh-1' });
  };

  const baseDto = (overrides: any = {}) => ({
    employeeId: 'emp-1',
    shiftId: 'sh-1',
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    weekdays: [1, 2, 3],
    ...overrides,
  });

  describe('create', () => {
    it('creates an assignment when no overlap exists', async () => {
      refsOk();
      prisma.shiftAssignment.findMany.mockResolvedValue([]);
      prisma.shiftAssignment.create.mockImplementation(async ({ data }: any) => ({ id: 'new', ...data }));
      const res: any = await service.create(baseDto());
      expect(res.id).toBe('new');
      expect(prisma.shiftAssignment.create).toHaveBeenCalled();
    });

    it('conflicts on overlapping date range with intersecting weekdays', async () => {
      refsOk();
      prisma.shiftAssignment.findMany.mockResolvedValue([
        { id: 'a-1', startDate: new Date('2026-01-15'), endDate: new Date('2026-02-15'), weekdays: [3, 4] },
      ]);
      await expect(service.create(baseDto())).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.shiftAssignment.create).not.toHaveBeenCalled();
    });

    it('treats null endDate as open-ended and conflicts', async () => {
      refsOk();
      prisma.shiftAssignment.findMany.mockResolvedValue([
        { id: 'a-1', startDate: new Date('2026-03-01'), endDate: null, weekdays: [1] },
      ]);
      // New open-ended assignment starting inside the existing open-ended range
      await expect(
        service.create(baseDto({ startDate: '2026-04-01', endDate: undefined, weekdays: [1] })),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('treats existing null endDate as open-ended against a later bounded range', async () => {
      refsOk();
      prisma.shiftAssignment.findMany.mockResolvedValue([
        { id: 'a-1', startDate: new Date('2026-01-01'), endDate: null, weekdays: [5] },
      ]);
      await expect(
        service.create(baseDto({ startDate: '2027-06-01', endDate: '2027-06-30', weekdays: [5] })),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('allows disjoint weekday sets on overlapping dates', async () => {
      refsOk();
      prisma.shiftAssignment.findMany.mockResolvedValue([
        { id: 'a-1', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), weekdays: [6, 7] },
      ]);
      prisma.shiftAssignment.create.mockImplementation(async ({ data }: any) => ({ id: 'new', ...data }));
      const res: any = await service.create(baseDto({ weekdays: [1, 2, 3] }));
      expect(res.id).toBe('new');
    });

    it('allows non-overlapping date ranges', async () => {
      refsOk();
      prisma.shiftAssignment.findMany.mockResolvedValue([
        { id: 'a-1', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31'), weekdays: [1, 2, 3] },
      ]);
      prisma.shiftAssignment.create.mockImplementation(async ({ data }: any) => ({ id: 'new', ...data }));
      const res: any = await service.create(
        baseDto({ startDate: '2026-02-01', endDate: '2026-02-28' }),
      );
      expect(res.id).toBe('new');
    });

    it('rejects empty weekdays', async () => {
      await expect(service.create(baseDto({ weekdays: [] }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.shiftAssignment.create).not.toHaveBeenCalled();
    });

    it('rejects out-of-range weekdays', async () => {
      await expect(service.create(baseDto({ weekdays: [0, 8] }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects endDate before startDate', async () => {
      await expect(
        service.create(baseDto({ startDate: '2026-02-01', endDate: '2026-01-01' })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFound for unknown employee or shift', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      prisma.shift.findFirst.mockResolvedValue({ id: 'sh-1' });
      await expect(service.create(baseDto())).rejects.toBeInstanceOf(NotFoundException);

      prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1' });
      prisma.shift.findFirst.mockResolvedValue(null);
      await expect(service.create(baseDto())).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('excludes self from the overlap guard', async () => {
      const self = {
        id: 'a-1',
        employeeId: 'emp-1',
        shiftId: 'sh-1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        weekdays: [1, 2, 3],
      };
      prisma.shiftAssignment.findUnique.mockResolvedValue(self);
      refsOk();
      // Only the record itself "overlaps" — must be skipped
      prisma.shiftAssignment.findMany.mockResolvedValue([self]);
      prisma.shiftAssignment.update.mockImplementation(async ({ data }: any) => ({ ...self, ...data }));
      const res: any = await service.update('a-1', { note: 'shift malam' } as any);
      expect(res.note).toBe('shift malam');
    });

    it('still conflicts against OTHER overlapping assignments on update', async () => {
      const self = {
        id: 'a-1',
        employeeId: 'emp-1',
        shiftId: 'sh-1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        weekdays: [1, 2, 3],
      };
      prisma.shiftAssignment.findUnique.mockResolvedValue(self);
      refsOk();
      prisma.shiftAssignment.findMany.mockResolvedValue([
        self,
        { id: 'a-2', startDate: new Date('2026-01-10'), endDate: new Date('2026-02-10'), weekdays: [2] },
      ]);
      await expect(service.update('a-1', { note: 'x' } as any)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.shiftAssignment.update).not.toHaveBeenCalled();
    });

    it('throws NotFound for unknown id', async () => {
      prisma.shiftAssignment.findUnique.mockResolvedValue(null);
      await expect(service.update('nope', { note: 'x' } as any)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('returns employee+shift includes with pagination meta', async () => {
      prisma.shiftAssignment.findMany.mockResolvedValue([
        { id: 'a-1', employee: { id: 'emp-1' }, shift: { id: 'sh-1' } },
      ]);
      prisma.shiftAssignment.count.mockResolvedValue(1);
      const res: any = await service.findAll({ employeeId: 'emp-1' } as any);
      expect(res.data).toHaveLength(1);
      expect(res.meta).toMatchObject({ total: 1, page: 1, limit: 20, totalPages: 1 });
      expect(prisma.shiftAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ include: { employee: true, shift: true } }),
      );
    });

    it('builds an activeOn date-overlap filter', async () => {
      prisma.shiftAssignment.findMany.mockResolvedValue([]);
      prisma.shiftAssignment.count.mockResolvedValue(0);
      await service.findAll({ activeOn: '2026-06-15' } as any);
      const where = prisma.shiftAssignment.findMany.mock.calls[0][0].where;
      expect(where.AND).toHaveLength(2);
    });
  });

  describe('delete', () => {
    it('hard-deletes the assignment', async () => {
      prisma.shiftAssignment.findUnique.mockResolvedValue({ id: 'a-1' });
      prisma.shiftAssignment.delete.mockResolvedValue({});
      await service.delete('a-1');
      expect(prisma.shiftAssignment.delete).toHaveBeenCalledWith({ where: { id: 'a-1' } });
    });

    it('throws NotFound for unknown id', async () => {
      prisma.shiftAssignment.findUnique.mockResolvedValue(null);
      await expect(service.delete('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
