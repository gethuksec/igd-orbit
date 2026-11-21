import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  NotFoundException,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { KPIService } from './services/kpi.service';
import { PrismaService } from '../../shared/services/prisma.service';
import { CreateAspectDto, UpdateAspectDto, UpsertConfigDto } from './dto/kpi-aspect.dto';
import { SaveGridDto } from './dto/kpi-grid.dto';

interface ExpressRequest extends Request {
  user: {
    id: string;
    roles: string[];
  };
}

/**
 * KPI master per division (IGDERP-266).
 * Aspects CRUD (CHR) -> monthly scoring grid (senior: HS/SPV/CHR)
 * -> HR lock (CHR) -> payroll reads locked NILAI. Staff view is
 * read-only for any authenticated user.
 */
@Controller('kpi')
@UseGuards(JwtAuthGuard)
export class KPIController {
  constructor(
    private readonly kpiService: KPIService,
    private readonly prisma: PrismaService,
  ) {}

  // ---------- aspects (master, CHR) ----------

  @Get('divisions/:divisionId/aspects')
  @UseGuards(RolesGuard)
  @Roles('CHR', 'CFO', 'OWNER', 'HS', 'SPV')
  async listAspects(@Param('divisionId') divisionId: string) {
    return this.kpiService.listAspects(divisionId);
  }

  @Post('divisions/:divisionId/aspects')
  @UseGuards(RolesGuard)
  @Roles('CHR')
  async createAspect(@Param('divisionId') divisionId: string, @Body() dto: CreateAspectDto) {
    return this.kpiService.createAspect(divisionId, dto);
  }

  @Put('aspects/:id')
  @UseGuards(RolesGuard)
  @Roles('CHR')
  async updateAspect(@Param('id') id: string, @Body() dto: UpdateAspectDto) {
    return this.kpiService.updateAspect(id, dto);
  }

  // ---------- division config (default amount, CHR) ----------

  @Get('divisions/:divisionId/config')
  @UseGuards(RolesGuard)
  @Roles('CHR', 'CFO', 'OWNER', 'HS', 'SPV')
  async getConfig(@Param('divisionId') divisionId: string) {
    return this.kpiService.getConfig(divisionId);
  }

  @Put('divisions/:divisionId/config')
  @UseGuards(RolesGuard)
  @Roles('CHR')
  async upsertConfig(@Param('divisionId') divisionId: string, @Body() dto: UpsertConfigDto) {
    return this.kpiService.upsertConfig(divisionId, dto);
  }

  // ---------- scoring grid (senior) ----------

  @Get('divisions/:divisionId/grid')
  @UseGuards(RolesGuard)
  @Roles('CHR', 'CFO', 'OWNER', 'HS', 'SPV')
  async getGrid(
    @Param('divisionId') divisionId: string,
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
  ) {
    return this.kpiService.getGrid(divisionId, month, year);
  }

  @Put('divisions/:divisionId/grid')
  @UseGuards(RolesGuard)
  @Roles('HS', 'SPV', 'CHR')
  async saveGrid(
    @Request() req: ExpressRequest,
    @Param('divisionId') divisionId: string,
    @Body() dto: SaveGridDto,
  ) {
    return this.kpiService.saveGrid(divisionId, dto, req.user.id);
  }

  // ---------- HR lock ----------

  @Post('divisions/:divisionId/lock')
  @UseGuards(RolesGuard)
  @Roles('CHR')
  async lockPeriod(
    @Request() req: ExpressRequest,
    @Param('divisionId') divisionId: string,
    @Body() body: { period_month: number; period_year: number },
  ) {
    return this.kpiService.lockPeriod(divisionId, body.period_month, body.period_year, req.user.id);
  }

  // ---------- staff view (read-only) ----------

  @Get('employee/:userId')
  async getEmployeeKpi(
    @Param('userId') userId: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    return this.kpiService.getEmployeeKpi(
      employee.id,
      month ? parseInt(month, 10) : undefined,
      year ? parseInt(year, 10) : undefined,
    );
  }
}
