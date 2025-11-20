import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';
import { BranchAccessService } from './branch-access.service';
import { ForbiddenException } from '@nestjs/common';

describe('BranchAccessService', () => {
  let service: BranchAccessService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    userRole: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BranchAccessService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<BranchAccessService>(BranchAccessService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAccessibleBranchIds', () => {
    it('should return null when user has global access (branchId is null)', async () => {
      mockPrismaService.userRole.findMany.mockResolvedValue([
        {
          id: 'ur-1',
          userId: 'user-1',
          roleId: 'role-1',
          branchId: null, // Global access
          validUntil: null,
        },
      ]);

      const result = await service.getAccessibleBranchIds('user-1');

      expect(result).toBeNull();
    });

    it('should return array of branch IDs when user has specific branch access', async () => {
      mockPrismaService.userRole.findMany.mockResolvedValue([
        {
          id: 'ur-1',
          userId: 'user-1',
          roleId: 'role-1',
          branchId: 'branch-1',
          validUntil: null,
        },
        {
          id: 'ur-2',
          userId: 'user-1',
          roleId: 'role-2',
          branchId: 'branch-2',
          validUntil: null,
        },
      ]);

      const result = await service.getAccessibleBranchIds('user-1');

      expect(result).toEqual(['branch-1', 'branch-2']);
    });

    it('should return empty array when user has no roles', async () => {
      mockPrismaService.userRole.findMany.mockResolvedValue([]);

      const result = await service.getAccessibleBranchIds('user-1');

      expect(result).toEqual([]);
    });

    it('should filter out expired roles', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1);

      // Mock findMany to filter expired roles (service does this in where clause)
      mockPrismaService.userRole.findMany.mockImplementation((args: any) => {
        // Simulate Prisma filtering - only return non-expired roles
        const mockData = [
          {
            id: 'ur-1',
            userId: 'user-1',
            roleId: 'role-1',
            branchId: 'branch-1',
            validUntil: expiredDate, // Expired
          },
          {
            id: 'ur-2',
            userId: 'user-1',
            roleId: 'role-2',
            branchId: 'branch-2',
            validUntil: null, // Not expired
          },
        ];
        
        // Filter based on where clause (simulate Prisma behavior)
        const now = new Date();
        return Promise.resolve(
          mockData.filter(
            (ur) => !ur.validUntil || ur.validUntil > now,
          ),
        );
      });

      const result = await service.getAccessibleBranchIds('user-1');

      // Should only include non-expired roles
      expect(result).toEqual(['branch-2']);
    });

    it('should remove duplicate branch IDs', async () => {
      mockPrismaService.userRole.findMany.mockResolvedValue([
        {
          id: 'ur-1',
          userId: 'user-1',
          roleId: 'role-1',
          branchId: 'branch-1',
          validUntil: null,
        },
        {
          id: 'ur-2',
          userId: 'user-1',
          roleId: 'role-2',
          branchId: 'branch-1', // Duplicate
          validUntil: null,
        },
      ]);

      const result = await service.getAccessibleBranchIds('user-1');

      expect(result).toEqual(['branch-1']);
    });
  });

  describe('canAccessBranch', () => {
    it('should return true when user has global access', async () => {
      jest.spyOn(service, 'getAccessibleBranchIds').mockResolvedValue(null);

      const result = await service.canAccessBranch('user-1', 'branch-1');

      expect(result).toBe(true);
    });

    it('should return true when user has access to the branch', async () => {
      jest
        .spyOn(service, 'getAccessibleBranchIds')
        .mockResolvedValue(['branch-1', 'branch-2']);

      const result = await service.canAccessBranch('user-1', 'branch-1');

      expect(result).toBe(true);
    });

    it('should return false when user does not have access to the branch', async () => {
      jest
        .spyOn(service, 'getAccessibleBranchIds')
        .mockResolvedValue(['branch-1', 'branch-2']);

      const result = await service.canAccessBranch('user-1', 'branch-3');

      expect(result).toBe(false);
    });
  });

  describe('ensureBranchAccess', () => {
    it('should not throw when user has access', async () => {
      jest.spyOn(service, 'canAccessBranch').mockResolvedValue(true);

      await expect(
        service.ensureBranchAccess('user-1', 'branch-1'),
      ).resolves.not.toThrow();
    });

    it('should throw ForbiddenException when user does not have access', async () => {
      jest.spyOn(service, 'canAccessBranch').mockResolvedValue(false);

      await expect(
        service.ensureBranchAccess('user-1', 'branch-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('filterByBranchAccess', () => {
    it('should return original where clause when user has global access', async () => {
      jest.spyOn(service, 'getAccessibleBranchIds').mockResolvedValue(null);

      const whereClause = { status: 'active' };
      const result = await service.filterByBranchAccess('user-1', whereClause);

      expect(result).toEqual(whereClause);
    });

    it('should add branch filter when user has specific branch access', async () => {
      jest
        .spyOn(service, 'getAccessibleBranchIds')
        .mockResolvedValue(['branch-1', 'branch-2']);

      const whereClause = { status: 'active' };
      const result = await service.filterByBranchAccess('user-1', whereClause);

      expect(result).toEqual({
        status: 'active',
        branchId: { in: ['branch-1', 'branch-2'] },
      });
    });

    it('should return impossible condition when user has no branch access', async () => {
      jest.spyOn(service, 'getAccessibleBranchIds').mockResolvedValue([]);

      const whereClause = { status: 'active' };
      const result = await service.filterByBranchAccess('user-1', whereClause);

      expect(result).toEqual({
        status: 'active',
        id: 'impossible-id-that-will-never-match',
      });
    });
  });
});

