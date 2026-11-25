import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { CategoriesService } from './categories.service';
import { MASTER_CODE_PATTERN } from '../../common/master-code.util';

/**
 * IGDERP-317 — CategoryGrade scoped CRUD + guards.
 * Grades are unique per category; codes are global-unique 10-char [A-Z0-9].
 */
describe('CategoriesService grades (IGDERP-317)', () => {
  let service: CategoriesService;
  let prisma: any;

  const gradeRow = {
    id: 'grade-1',
    categoryId: 'cat-1',
    code: 'AAAAAAAAAA',
    name: 'ORI',
    isActive: true,
  };

  beforeEach(async () => {
    prisma = {
      category: {
        findMany: jest.fn().mockResolvedValue([{ id: 'cat-1' }]),
        findUnique: jest.fn().mockImplementation(async (args: any) => {
          if (args?.where?.id === 'cat-1') {
            return { id: 'cat-1', _count: { products: 0, childCategories: 0, grades: 0 } };
          }
          return null;
        }),
        count: jest.fn().mockResolvedValue(1),
      },
      categoryGrade: {
        findMany: jest.fn().mockResolvedValue([gradeRow]),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async (args: any) => ({ id: 'grade-new', ...args.data })),
        update: jest.fn().mockImplementation(async (args: any) => ({ ...gradeRow, ...args.data })),
        count: jest.fn().mockResolvedValue(1),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      productStock: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CategoriesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  it('listGrades returns the category grades, 404 for unknown category', async () => {
    await expect(service.listGrades('cat-1')).resolves.toEqual([gradeRow]);
    await expect(service.listGrades('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('createGrade auto-generates a 10-char code when omitted', async () => {
    const created = await service.createGrade('cat-1', { name: 'KW' });
    expect(created.code).toMatch(MASTER_CODE_PATTERN);
    expect(prisma.categoryGrade.create).toHaveBeenCalledWith({
      data: { categoryId: 'cat-1', name: 'KW', code: expect.stringMatching(MASTER_CODE_PATTERN) },
    });
  });

  it('createGrade accepts an explicit valid code', async () => {
    const created = await service.createGrade('cat-1', { name: 'KW', code: 'BBBBBBBBBB' });
    expect(created.code).toBe('BBBBBBBBBB');
  });

  it('createGrade rejects scoped-duplicate names (case-insensitive)', async () => {
    prisma.categoryGrade.findFirst.mockResolvedValue({ id: 'grade-1' });
    await expect(service.createGrade('cat-1', { name: 'ori' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('createGrade rejects duplicate codes', async () => {
    prisma.categoryGrade.findUnique.mockResolvedValue({ id: 'other' });
    await expect(service.createGrade('cat-1', { name: 'KW', code: 'AAAAAAAAAA' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('createGrade 404s for unknown category', async () => {
    await expect(service.createGrade('nope', { name: 'KW' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updateGrade renames and recodes', async () => {
    prisma.categoryGrade.findUnique.mockResolvedValue({ ...gradeRow });
    const updated = await service.updateGrade('cat-1', 'grade-1', { name: 'Premium', code: 'CCCCCCCCCC' });
    expect(updated).toMatchObject({ name: 'Premium', code: 'CCCCCCCCCC' });
  });

  it('updateGrade 404s when the grade belongs to another category', async () => {
    prisma.categoryGrade.findUnique.mockResolvedValue({ ...gradeRow, categoryId: 'cat-2' });
    await expect(service.updateGrade('cat-1', 'grade-1', { name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updateGrade blocks deactivating a grade linked to products', async () => {
    prisma.categoryGrade.findUnique.mockResolvedValue({ ...gradeRow });
    prisma.product.count.mockResolvedValue(3);
    await expect(service.updateGrade('cat-1', 'grade-1', { isActive: false })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('updateGrade allows deactivating an unlinked grade', async () => {
    prisma.categoryGrade.findUnique.mockResolvedValue({ ...gradeRow });
    const updated = await service.updateGrade('cat-1', 'grade-1', { isActive: false });
    expect(updated.isActive).toBe(false);
  });

  it('deleteGrade soft-deletes; blocked while products reference it', async () => {
    prisma.categoryGrade.findUnique.mockResolvedValue({ ...gradeRow });
    await service.deleteGrade('cat-1', 'grade-1');
    expect(prisma.categoryGrade.update).toHaveBeenCalledWith({
      where: { id: 'grade-1' },
      data: { isActive: false },
    });

    prisma.product.count.mockResolvedValue(1);
    await expect(service.deleteGrade('cat-1', 'grade-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('delete category is blocked while grades exist', async () => {
    prisma.category.findUnique.mockResolvedValue({
      id: 'cat-1',
      _count: { products: 0, childCategories: 0, grades: 2 },
    });
    await expect(service.delete('cat-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('generateGradeCode returns 10-char codes', async () => {
    await expect(service.generateGradeCode()).resolves.toMatch(MASTER_CODE_PATTERN);
  });
});
