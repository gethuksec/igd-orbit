import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';
import { CreateCategoryGradeDto, UpdateCategoryGradeDto } from './dto';
import { generateMasterCode } from '../../common/master-code.util';

/**
 * Category Tree Node Interface
 */
export interface CategoryTree {
  id: string;
  code: string;
  name: string;
  description: string | null;
  level: number;
  parentCategoryId: string | null;
  sortOrder: number | null;
  imageUrl: string | null;
  isActive: boolean;
  productCount: number;
  children: CategoryTree[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Categories Service
 * Handles category management operations with tree structure
 */
@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate unique category code
   * Format: flat 10-char alphanumeric [A-Z0-9] (IGDERP-316)
   * @returns Generated code string
   */
  async generateCode(): Promise<string> {
    let code: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      code = generateMasterCode();

      const existing = await this.prisma.category.findUnique({
        where: { code },
      });

      if (!existing) {
        isUnique = true;
      }

      attempts++;
    }

    if (!isUnique) {
      throw new BadRequestException('Failed to generate unique code after multiple attempts');
    }

    return code!;
  }

  /**
   * IGDERP-317 — generate a unique grade code (flat 10-char [A-Z0-9]).
   */
  async generateGradeCode(): Promise<string> {
    let code: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      code = generateMasterCode();

      const existing = await this.prisma.categoryGrade.findUnique({
        where: { code },
      });

      if (!existing) {
        isUnique = true;
      }

      attempts++;
    }

    if (!isUnique) {
      throw new BadRequestException('Failed to generate unique code after multiple attempts');
    }

    return code!;
  }

  /**
   * IGDERP-317 — list grades scoped to one category.
   */
  async listGrades(categoryId: string, activeOnly = false) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return this.prisma.categoryGrade.findMany({
      where: { categoryId, ...(activeOnly ? { isActive: true } : {}) },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * IGDERP-317 — create a grade inside a category scope.
   * Name must be unique within the category (case-insensitive); code is
   * global-unique and auto-generated when omitted.
   */
  async createGrade(categoryId: string, dto: CreateCategoryGradeDto) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    const name = (dto.name || '').trim();
    if (!name) {
      throw new BadRequestException('Grade name is required');
    }
    const clash = await this.prisma.categoryGrade.findFirst({
      where: { categoryId, name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException(`Grade '${name}' already exists in this category`);
    }
    let code = (dto.code || '').trim().toUpperCase();
    if (code) {
      const codeTaken = await this.prisma.categoryGrade.findUnique({
        where: { code },
        select: { id: true },
      });
      if (codeTaken) {
        throw new ConflictException(`Grade code '${code}' already exists`);
      }
    } else {
      code = await this.generateGradeCode();
    }
    return this.prisma.categoryGrade.create({
      data: { categoryId, name, code },
    });
  }

  /**
   * IGDERP-317 — update a grade (rename / recode / activate toggle).
   * Deactivating a grade that is linked to products is blocked.
   */
  async updateGrade(categoryId: string, gradeId: string, dto: UpdateCategoryGradeDto) {
    const grade = await this.prisma.categoryGrade.findUnique({
      where: { id: gradeId },
    });
    if (!grade || grade.categoryId !== categoryId) {
      throw new NotFoundException('Grade not found in this category');
    }
    const data: any = {};
    if (dto.name !== undefined) {
      const name = (dto.name || '').trim();
      if (!name) {
        throw new BadRequestException('Grade name is required');
      }
      const clash = await this.prisma.categoryGrade.findFirst({
        where: {
          categoryId,
          name: { equals: name, mode: 'insensitive' },
          NOT: { id: gradeId },
        },
        select: { id: true },
      });
      if (clash) {
        throw new ConflictException(`Grade '${name}' already exists in this category`);
      }
      data.name = name;
    }
    if (dto.code !== undefined) {
      const code = (dto.code || '').trim().toUpperCase();
      if (!code) {
        throw new BadRequestException('Grade code is required');
      }
      const codeTaken = await this.prisma.categoryGrade.findFirst({
        where: { code, NOT: { id: gradeId } },
        select: { id: true },
      });
      if (codeTaken) {
        throw new ConflictException(`Grade code '${code}' already exists`);
      }
      data.code = code;
    }
    if (dto.isActive !== undefined) {
      if (dto.isActive === false && grade.isActive) {
        await this.assertGradeNotLinked(gradeId, 'Cannot deactivate grade with linked product(s)');
      }
      data.isActive = dto.isActive;
    }
    if (Object.keys(data).length === 0) {
      return grade;
    }
    return this.prisma.categoryGrade.update({
      where: { id: gradeId },
      data,
    });
  }

  /**
   * IGDERP-317 — soft-delete a grade (isActive=false). Blocked while any
   * product still references the grade.
   */
  async deleteGrade(categoryId: string, gradeId: string) {
    const grade = await this.prisma.categoryGrade.findUnique({
      where: { id: gradeId },
    });
    if (!grade || grade.categoryId !== categoryId) {
      throw new NotFoundException('Grade not found in this category');
    }
    await this.assertGradeNotLinked(gradeId, 'Cannot delete grade with linked product(s)');
    await this.prisma.categoryGrade.update({
      where: { id: gradeId },
      data: { isActive: false },
    });
  }

  /**
   * IGDERP-317 — shared guard: a grade with linked products can neither be
   * deactivated nor deleted.
   */
  private async assertGradeNotLinked(gradeId: string, message: string): Promise<void> {
    const linked = await this.prisma.product.count({
      where: { gradeId },
    });
    if (linked > 0) {
      throw new BadRequestException(`${message} (${linked}). Reassign those products first.`);
    }
  }

  /**
   * Check category depth
   * Max depth: 3 levels
   * @param categoryId - Category ID to check
   * @returns Current depth level
   */
  async getCategoryDepth(categoryId: string): Promise<number> {
    let depth = 0;
    let currentId: string | null = categoryId;

    while (currentId && depth < 10) {
      const category: { parentCategoryId: string | null } | null =
        await this.prisma.category.findUnique({
          where: { id: currentId },
          select: { parentCategoryId: true },
        });

      if (!category || !category.parentCategoryId) {
        break;
      }

      depth++;
      currentId = category.parentCategoryId;
    }

    return depth;
  }

  /**
   * Build category tree structure
   * @param categories - Flat list of categories
   * @param parentId - Parent category ID (null for root)
   * @param level - Current depth level
   * @returns Tree structure
   */
  private buildTree(
    categories: Array<any & { productCount: number }>,
    parentId: string | null = null,
    level: number = 0,
  ): CategoryTree[] {
    return categories
      .filter((cat) => cat.parentCategoryId === parentId)
      .map((cat) => ({
        id: cat.id,
        code: cat.code,
        name: cat.name,
        description: cat.description,
        level,
        parentCategoryId: cat.parentCategoryId,
        sortOrder: (cat as any).sortOrder || null,
        imageUrl: (cat as any).imageUrl || null,
        isActive: cat.isActive,
        productCount: cat.productCount,
        children: this.buildTree(categories, cat.id, level + 1),
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Find all categories in tree structure
   * @returns Hierarchical tree structure
   */
  async findAll(): Promise<CategoryTree[]> {
    const categories = await this.prisma.category.findMany({
      where: {
        isActive: true,
      },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: [
        { parentCategoryId: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    const categoriesWithCount = categories.map((cat) => ({
      ...cat,
      productCount: cat._count.products,
    }));

    return this.buildTree(categoriesWithCount);
  }

  /**
   * Find all categories as flat list with pagination
   * @param page - Page number (1-based)
   * @param limit - Items per page
   * @param search - Search term for name/code
   * @param isActive - Filter by active status (optional)
   * @returns Paginated flat list
   */
  async findAllPaginated(
    page: number = 1,
    limit: number = 20,
    search?: string,
    isActive?: boolean,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    // Filter by active status if provided
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // Search filter
    if (search && search.trim().length > 0) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { code: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const [categories, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        include: {
          parentCategory: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          _count: {
            select: {
              products: true,
            },
          },
        },
        orderBy: [
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      this.prisma.category.count({ where }),
    ]);

    const categoriesWithCount = categories.map((cat) => ({
      id: cat.id,
      code: cat.code,
      name: cat.name,
      description: cat.description,
      parentCategoryId: cat.parentCategoryId,
      parentCategory: cat.parentCategory
        ? {
            id: cat.parentCategory.id,
            name: cat.parentCategory.name,
            code: cat.parentCategory.code,
          }
        : null,
      productCount: cat._count.products,
      totalSku: cat._count.products,
      totalStock: 0,
      grades: [] as Array<{ id: string; code: string; name: string }>,
      isActive: cat.isActive,
      tierMargins: cat.tierMargins,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
    }));

    // Enhancement-only aggregates: totalStock (sum of quantityAvailable over
    // the category's products) + CategoryGrade rows (IGDERP-317 master).
    // Degrades to zeros on query failure so a missing table pre-migration
    // never breaks the list.
    let totalGrades = 0;
    try {
      const categoryIds = categoriesWithCount.map((c) => c.id);
      if (categoryIds.length > 0) {
        const products = await this.prisma.product.findMany({
          where: { categoryId: { in: categoryIds } },
          select: { id: true, categoryId: true },
        });
        const productIds = products.map((p) => p.id);
        const stockByProduct = new Map<string, number>();
        if (productIds.length > 0) {
          const sums = await this.prisma.productStock.groupBy({
            by: ['productId'],
            where: { productId: { in: productIds } },
            _sum: { quantityAvailable: true },
          });
          for (const s of sums) {
            stockByProduct.set(s.productId, Number(s._sum.quantityAvailable ?? 0));
          }
        }
        const byCategory = new Map<string, number>();
        for (const p of products) {
          byCategory.set(p.categoryId, (byCategory.get(p.categoryId) ?? 0) + (stockByProduct.get(p.id) ?? 0));
        }
        const gradeRows = await this.prisma.categoryGrade.findMany({
          where: { categoryId: { in: categoryIds }, isActive: true },
          select: { id: true, code: true, name: true, categoryId: true },
          orderBy: { name: 'asc' },
        });
        const gradesByCategory = new Map<string, Array<{ id: string; code: string; name: string }>>();
        for (const g of gradeRows) {
          const list = gradesByCategory.get(g.categoryId) ?? [];
          if (list.length < 20) {
            list.push({ id: g.id, code: g.code, name: g.name });
            gradesByCategory.set(g.categoryId, list);
          }
        }
        for (const c of categoriesWithCount) {
          c.totalStock = byCategory.get(c.id) ?? 0;
          c.grades = gradesByCategory.get(c.id) ?? [];
        }
        // Total Grade StatCard: active grades across the whole FILTERED set
        // (not just this page), so the number is stable under pagination.
        const filteredIds = (
          await this.prisma.category.findMany({ where, select: { id: true } })
        ).map((r) => r.id);
        if (filteredIds.length > 0) {
          totalGrades = await this.prisma.categoryGrade.count({
            where: { categoryId: { in: filteredIds }, isActive: true },
          });
        }
      }
    } catch (e) {
      console.warn('categories.findAllPaginated aggregates degraded:', (e as Error)?.message || e);
    }

    return {
      data: categoriesWithCount,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalGrades,
      },
    };
  }

  /**
   * Find category tree (alias for findAll)
   * @returns Tree structure
   */
  async findTree(): Promise<CategoryTree[]> {
    return this.findAll();
  }

  /**
   * Find category by ID with parent and children
   * @param id - Category ID
   * @returns Category with relations
   */
  async findById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parentCategory: true,
        childCategories: {
          where: { isActive: true },
          include: {
            _count: {
              select: {
                products: true,
              },
            },
          },
        },
        _count: {
          select: {
            products: true,
            childCategories: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return {
      id: category.id,
      code: category.code,
      name: category.name,
      description: category.description,
      parentCategoryId: category.parentCategoryId,
      parentCategory: category.parentCategory
        ? {
            id: category.parentCategory.id,
            code: category.parentCategory.code,
            name: category.parentCategory.name,
          }
        : null,
      childCategories: category.childCategories.map((child) => ({
        id: child.id,
        code: child.code,
        name: child.name,
        productCount: child._count.products,
      })),
      productCount: category._count.products,
      subCategoryCount: category._count.childCategories,
      isActive: category.isActive,
      tierMargins: category.tierMargins,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  /**
   * Create new category
   * @param createCategoryDto - Category creation data
   * @returns Created category
   */
  async create(createCategoryDto: CreateCategoryDto) {
    // Generate code if not provided
    let code = createCategoryDto.code;
    if (!code) {
      code = await this.generateCode();
    } else {
      // Check code uniqueness
      const existing = await this.prisma.category.findUnique({
        where: { code },
      });
      if (existing) {
        throw new ConflictException('Category code already exists');
      }
    }

    // Validate parent category if provided
    if (createCategoryDto.parentCategoryId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: createCategoryDto.parentCategoryId },
      });

      if (!parent) {
        throw new NotFoundException('Parent category not found');
      }

      // Check max depth (3 levels)
      const parentDepth = await this.getCategoryDepth(createCategoryDto.parentCategoryId);
      if (parentDepth >= 2) {
        throw new BadRequestException('Maximum category depth (3 levels) exceeded');
      }
    }

    // Check name uniqueness within same parent (check all categories, not just active)
    // Allow duplicate name if existing category is inactive
    const existingName = await this.prisma.category.findFirst({
      where: {
        name: createCategoryDto.name,
        parentCategoryId: createCategoryDto.parentCategoryId || null,
      },
    });

    if (existingName) {
      // If existing category is active, throw error
      if (existingName.isActive) {
        throw new ConflictException(
          'Category name must be unique within the same parent category',
        );
      }
      // If existing category is inactive, we can still create, but log a warning
      // (or optionally reactivate the existing one - for now we allow creation)
    }

    // Prepare category data
    const categoryData: any = {
      code,
      name: createCategoryDto.name,
      description: createCategoryDto.description || null,
      parentCategoryId: createCategoryDto.parentCategoryId || null,
      isActive: createCategoryDto.isActive ?? true,
    };

    // TODO: Add sortOrder when field is added to schema
    // if (createCategoryDto.sortOrder !== undefined) {
    //   categoryData.sortOrder = createCategoryDto.sortOrder;
    // }
    // TODO: Add imageUrl when field is added to schema
    // if (createCategoryDto.imageUrl) {
    //   categoryData.imageUrl = createCategoryDto.imageUrl;
    // }
    
    // Add tierMargins if provided
    if (createCategoryDto.tierMargins !== undefined) {
      categoryData.tierMargins = createCategoryDto.tierMargins;
    }

    // Create category
    const category = await this.prisma.category.create({
      data: categoryData,
      include: {
        parentCategory: true,
        _count: {
          select: {
            products: true,
            childCategories: true,
          },
        },
      },
    });

    return {
      id: category.id,
      code: category.code,
      name: category.name,
      description: category.description,
      parentCategoryId: category.parentCategoryId,
      parentCategory: category.parentCategory
        ? {
            id: category.parentCategory.id,
            code: category.parentCategory.code,
            name: category.parentCategory.name,
          }
        : null,
      productCount: category._count.products,
      subCategoryCount: category._count.childCategories,
      isActive: category.isActive,
      tierMargins: category.tierMargins,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  /**
   * Update category
   * @param id - Category ID
   * @param updateCategoryDto - Category update data
   * @returns Updated category
   */
  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Check if trying to set self as parent
    if (updateCategoryDto.parentCategoryId === id) {
      throw new BadRequestException('Cannot set category as its own parent');
    }

    // Validate parent category if updating
    if (updateCategoryDto.parentCategoryId !== undefined) {
      if (updateCategoryDto.parentCategoryId) {
        const parent = await this.prisma.category.findUnique({
          where: { id: updateCategoryDto.parentCategoryId },
        });

        if (!parent) {
          throw new NotFoundException('Parent category not found');
        }

        // Check max depth
        const parentDepth = await this.getCategoryDepth(updateCategoryDto.parentCategoryId);
        if (parentDepth >= 2) {
          throw new BadRequestException('Maximum category depth (3 levels) exceeded');
        }

        // Check for circular reference (parent cannot be a descendant)
        const isDescendant = await this.isDescendant(updateCategoryDto.parentCategoryId, id);
        if (isDescendant) {
          throw new BadRequestException('Cannot set a descendant category as parent');
        }
      }
    }

    // Check name uniqueness within same parent if updating name
    if (updateCategoryDto.name) {
      const parentId = updateCategoryDto.parentCategoryId ?? category.parentCategoryId;
      const existingName = await this.prisma.category.findFirst({
        where: {
          name: updateCategoryDto.name,
          parentCategoryId: parentId || null,
          isActive: true,
          id: { not: id },
        },
      });

      if (existingName) {
        throw new ConflictException(
          'Category name must be unique within the same parent category',
        );
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (updateCategoryDto.name !== undefined) {
      updateData.name = updateCategoryDto.name;
    }
    if (updateCategoryDto.description !== undefined) {
      updateData.description = updateCategoryDto.description || null;
    }
    if (updateCategoryDto.parentCategoryId !== undefined) {
      updateData.parentCategoryId = updateCategoryDto.parentCategoryId || null;
    }
    // TODO: Add sortOrder when field is added to schema
    // if (updateCategoryDto.sortOrder !== undefined) {
    //   updateData.sortOrder = updateCategoryDto.sortOrder;
    // }
    // TODO: Add imageUrl when field is added to schema
    // if (updateCategoryDto.imageUrl !== undefined) {
    //   updateData.imageUrl = updateCategoryDto.imageUrl || null;
    // }
    if (updateCategoryDto.tierMargins !== undefined) {
      updateData.tierMargins = updateCategoryDto.tierMargins;
    }
    if (updateCategoryDto.isActive !== undefined) {
      updateData.isActive = updateCategoryDto.isActive;
    }
    if (updateCategoryDto.code !== undefined) {
      // Check code uniqueness if updating
      if (updateCategoryDto.code !== category.code) {
        const existing = await this.prisma.category.findUnique({
          where: { code: updateCategoryDto.code },
        });
        if (existing) {
          throw new ConflictException('Category code already exists');
        }
      }
      updateData.code = updateCategoryDto.code;
    }

    // Update category
    const updatedCategory = await this.prisma.category.update({
      where: { id },
      data: updateData,
      include: {
        parentCategory: true,
        _count: {
          select: {
            products: true,
            childCategories: true,
          },
        },
      },
    });

    return {
      id: updatedCategory.id,
      code: updatedCategory.code,
      name: updatedCategory.name,
      description: updatedCategory.description,
      parentCategoryId: updatedCategory.parentCategoryId,
      parentCategory: updatedCategory.parentCategory
        ? {
            id: updatedCategory.parentCategory.id,
            code: updatedCategory.parentCategory.code,
            name: updatedCategory.parentCategory.name,
          }
        : null,
      productCount: updatedCategory._count.products,
      subCategoryCount: updatedCategory._count.childCategories,
      isActive: updatedCategory.isActive,
      tierMargins: updatedCategory.tierMargins,
      createdAt: updatedCategory.createdAt,
      updatedAt: updatedCategory.updatedAt,
    };
  }

  /**
   * Check if a category is a descendant of another
   * @param ancestorId - Potential ancestor category ID
   * @param descendantId - Category ID to check
   * @returns True if descendantId is a descendant of ancestorId
   */
  private async isDescendant(ancestorId: string, descendantId: string): Promise<boolean> {
    let currentId: string | null = descendantId;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);

      if (currentId === ancestorId) {
        return true;
      }

      const category: { parentCategoryId: string | null } | null =
        await this.prisma.category.findUnique({
          where: { id: currentId },
          select: { parentCategoryId: true },
        });

      if (!category || !category.parentCategoryId) {
        break;
      }

      currentId = category.parentCategoryId;
    }

    return false;
  }

  /**
   * Soft delete category (sets isActive=false so the trash view can list it).
   * NOTE: Category has no deletedAt column (unlike Size/Product), so the
   * soft-delete is isActive=false only.
   * @param id - Category ID
   */
  async delete(id: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
            childCategories: true,
            grades: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Check if has products
    if (category._count.products > 0) {
      throw new BadRequestException(
        `Cannot delete category with ${category._count.products} product(s). Please remove or reassign products first.`,
      );
    }

    // Check if has subcategories
    if (category._count.childCategories > 0) {
      throw new BadRequestException(
        `Cannot delete category with ${category._count.childCategories} subcategor(ies). Please delete or reassign subcategories first.`,
      );
    }

    // IGDERP-317: category with grades cannot be deleted
    if (category._count.grades > 0) {
      throw new BadRequestException(
        `Cannot delete category with ${category._count.grades} grade(s). Please delete the grades first.`,
      );
    }

    // Soft delete (set isActive to false) so the trash view
    // (findAllPaginated with isActive=false) can list it
    await this.prisma.category.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Reorder categories
   * @param orders - Array of { id, sortOrder }
   * Note: sortOrder field will be added to schema in future migration
   */
  async reorder(orders: Array<{ id: string; sortOrder: number }>): Promise<void> {
    // TODO: Implement reorder when sortOrder field is added to schema
    // For now, we'll just validate that all categories exist
    for (const order of orders) {
      const category = await this.prisma.category.findUnique({
        where: { id: order.id },
      });
      if (!category) {
        throw new NotFoundException(`Category with ID ${order.id} not found`);
      }
    }
    // Update all categories in a transaction (when sortOrder field exists)
    // await this.prisma.$transaction(
    //   orders.map((order) =>
    //     this.prisma.category.update({
    //       where: { id: order.id },
    //       data: { sortOrder: order.sortOrder },
    //     }),
    //   ),
    // );
  }
}

