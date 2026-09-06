import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ListCustomersDto } from '../customers/dto/list-customers.dto';

/**
 * IGDERP-69 — kategori isActive ignored on update.
 * Root cause: CreateCategoryDto had no `isActive` property, so the global
 * ValidationPipe (whitelist:true) stripped it, AND update() never mapped it
 * into the Prisma update data.
 */
describe('CategoriesService isActive handling (IGDERP-69)', () => {
  let service: CategoriesService;
  let prisma: {
    category: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  const existingCategory = {
    id: 'cat-1',
    code: 'CAT-001',
    name: 'TEST-E2E Kategori',
    description: 'old',
    parentCategoryId: null,
    isActive: true,
  };

  beforeEach(async () => {
    prisma = {
      category: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.category.findUnique.mockResolvedValue(existingCategory);
      prisma.category.findFirst.mockResolvedValue(null);
      prisma.category.update.mockImplementation(async ({ data }: any) => ({
        ...existingCategory,
        ...data,
        parentCategory: null,
        _count: { products: 0, childCategories: 0 },
      }));
    });

    it('persists isActive:false on update (IGDERP-69 repro)', async () => {
      const result = await service.update('cat-1', {
        name: 'TEST-E2E Kategori',
        description: 'Kategori E2E - sudah diedit',
        isActive: false,
      } as UpdateCategoryDto);

      expect(prisma.category.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cat-1' },
          data: expect.objectContaining({ isActive: false }),
        }),
      );
      expect(result.isActive).toBe(false);
    });

    it('persists isActive:true (reactivate) on update', async () => {
      prisma.category.findUnique.mockResolvedValue({
        ...existingCategory,
        isActive: false,
      });

      const result = await service.update('cat-1', {
        isActive: true,
      } as UpdateCategoryDto);

      expect(prisma.category.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: true }),
        }),
      );
      expect(result.isActive).toBe(true);
    });

    it('leaves isActive untouched when omitted', async () => {
      await service.update('cat-1', {
        description: 'only desc',
      } as UpdateCategoryDto);

      const data = prisma.category.update.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('isActive');
    });
  });

  describe('create', () => {
    beforeEach(() => {
      prisma.category.findUnique.mockResolvedValue(null);
      prisma.category.findFirst.mockResolvedValue(null);
      prisma.category.create.mockImplementation(async ({ data }: any) => ({
        id: 'cat-new',
        ...data,
        parentCategory: null,
        _count: { products: 0, childCategories: 0 },
      }));
    });

    it('respects explicit isActive:false on create', async () => {
      const result = await service.create({
        code: 'CAT-TEST',
        name: 'Test Kategori',
        isActive: false,
      } as CreateCategoryDto);

      expect(prisma.category.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false }),
        }),
      );
      expect(result.isActive).toBe(false);
    });

    it('defaults isActive to true on create when omitted', async () => {
      const result = await service.create({
        code: 'CAT-TEST',
        name: 'Test Kategori',
      } as CreateCategoryDto);

      expect(prisma.category.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: true }),
        }),
      );
      expect(result.isActive).toBe(true);
    });
  });

  describe('ValidationPipe whitelist (regression: field must survive)', () => {
    // Same options as backend/src/main.ts global pipe
    const pipe = new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      whitelist: true,
      forbidNonWhitelisted: false,
    });

    it('isActive:false survives whitelist on UpdateCategoryDto', async () => {
      const out = (await pipe.transform(
        {
          name: 'TEST-E2E Kategori',
          description: 'Kategori E2E - sudah diedit',
          isActive: false,
          tierMargins: {},
        },
        { type: 'body', metatype: UpdateCategoryDto },
      )) as UpdateCategoryDto;

      expect((out as any).isActive).toBe(false);
    });

    it('ListCustomersDto limit contract: 1000 is rejected (IGDERP-66)', async () => {
      // Documents the backend contract the FE must respect:
      // limit must be one of 10/20/50/100 — ProductForm sends limit=100.
      // NOTE: this spec builds its pipe with Nest's default exceptionFactory,
      // so we assert on the structured response, not the joined message.
      let caught: any = null;
      try {
        await pipe.transform(
          { 'filter[type]': 'wholesale', limit: 1000 },
          { type: 'query', metatype: ListCustomersDto },
        );
      } catch (e) {
        caught = e;
      }
      expect(caught).not.toBeNull();
      expect(caught.getStatus()).toBe(400);
      expect(JSON.stringify(caught.getResponse())).toContain(
        'Limit must be one of: 10, 20, 50, 100',
      );
    });

    it('ListCustomersDto accepts filter[type]=wholesale + limit=100', async () => {
      const out = (await pipe.transform(
        { 'filter[type]': 'wholesale', limit: 100 },
        { type: 'query', metatype: ListCustomersDto },
      )) as ListCustomersDto;

      expect(out['filter[type]']).toBe('wholesale');
      expect(out.limit).toBe(100);
    });
  });
});
