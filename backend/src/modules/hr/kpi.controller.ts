import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { KPIService } from './services/kpi.service';
import { PrismaService } from '../../shared/services/prisma.service';
import { CreateKPIDto } from './dto/create-kpi.dto';
import { UpdateKPIScoreDto } from './dto/update-kpi-score.dto';

interface ExpressRequest extends Request {
  user: {
    id: string;
    roles: string[];
  };
}

@Controller('kpi')
@UseGuards(JwtAuthGuard)
export class KPIController {
  constructor(
    private readonly kpiService: KPIService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Record KPI
   * POST /api/v1/kpi/records
   */
  @Post('records')
  @UseGuards(RolesGuard)
  @Roles('HS', 'SPV', 'CHR')
  async recordKPI(@Request() req: ExpressRequest, @Body() dto: CreateKPIDto) {
    return this.kpiService.recordKPI(dto, req.user.id, req.user.roles);
  }

  /**
   * Get employee KPIs
   * GET /api/v1/kpi/records/:userId
   */
  @Get('records/:userId')
  async getEmployeeKPIs(
    @Param('userId') userId: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    // Get employee by userId
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    return this.kpiService.getEmployeeKPIs(
      employee.id,
      month ? parseInt(month, 10) : undefined,
      year ? parseInt(year, 10) : undefined,
    );
  }

  /**
   * Update KPI score
   * POST /api/v1/kpi/records/:id/score
   */
  @Post('records/:id/score')
  @UseGuards(RolesGuard)
  @Roles('HS', 'SPV', 'CHR')
  async updateScore(
    @Request() req: ExpressRequest,
    @Param('id') id: string,
    @Body() dto: UpdateKPIScoreDto,
  ) {
    return this.kpiService.updateScore(id, dto, req.user.id, req.user.roles);
  }

  /**
   * Get KPI record by ID
   * GET /api/v1/kpi/records/:id
   */
  @Get('records/:id')
  async findById(@Param('id') id: string) {
    return this.kpiService.findById(id);
  }
}

