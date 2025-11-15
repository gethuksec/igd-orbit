import { Controller, Get, Param } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { Public } from '../../shared/decorators/public.decorator';

@Controller('branches')
export class BranchesController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all active branches (public endpoint)
   * GET /api/v1/branches
   */
  @Get()
  @Public()
  async findAll() {
    return this.prisma.branch.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        city: true,
        province: true,
        operatingHours: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get branch by ID (public endpoint)
   * GET /api/v1/branches/:id
   */
  @Get(':id')
  @Public()
  async findById(@Param('id') id: string) {
    return this.prisma.branch.findUnique({
      where: { id, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        city: true,
        province: true,
        operatingHours: true,
      },
    });
  }
}

