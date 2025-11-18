import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';
import { randomBytes } from 'crypto';

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
   * Format: CAT-{random}
   * @returns Generated code string
   */
  async generateCode(): Promise<string> {
    let code: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const random = randomBytes(4).toString('hex').toUpperCase();
      code = `CAT-${random}`;

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
      isActive: cat.isActive,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
    }));

    return {
      data: categoriesWithCount,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
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
      isActive: true,
    };

    // TODO: Add sortOrder when field is added to schema
    // if (createCategoryDto.sortOrder !== undefined) {
    //   categoryData.sortOrder = createCategoryDto.sortOrder;
    // }
    // TODO: Add imageUrl when field is added to schema
    // if (createCategoryDto.imageUrl) {
    //   categoryData.imageUrl = createCategoryDto.imageUrl;
    // }

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
   * Delete category
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

    // Delete category
    await this.prisma.category.delete({
      where: { id },
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

