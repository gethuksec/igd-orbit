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

const SCORERS = ['CHR', 'CFO', 'OWNER', 'HS', 'SPV'] as const;

/**
 * KPI assign/edit flow (IGDERP-266 rework).
 * Division list -> assign wizard (aspects prefilled, employee inputs)
 * -> edit tabs (per karyawan / aspek) -> Approved by HR (immutable,
 * payroll reads approved NILAI). Staff view is read-only.
 */
@Controller('kpi')
@UseGuards(JwtAuthGuard)
export class KPIController {
  constructor(
    private readonly kpiService: KPIService,
    private readonly prisma: PrismaService,
  ) {}

  // ---------- division list (scoped: all for super roles, own for superiors) ----------

  @Get('divisions')
  @UseGuards(RolesGuard)
  @Roles(...SCORERS)
  async listDivisions(@Request() req: ExpressRequest) {
    return this.kpiService.listDivisions(req.user.id, req.user.roles);
  }

  // ---------- aspects (master, scoped to division) ----------

  @Get('divisions/:divisionId/aspects')
  @UseGuards(RolesGuard)
  @Roles(...SCORERS)
  async listAspects(@Request() req: ExpressRequest, @Param('divisionId') divisionId: string) {
    await this.kpiService.assertDivisionScope(req.user.id, req.user.roles, divisionId);
    return this.kpiService.listAspects(divisionId);
  }

  @Post('divisions/:divisionId/aspects')
  @UseGuards(RolesGuard)
  @Roles('CHR', 'HS', 'SPV')
  async createAspect(
    @Request() req: ExpressRequest,
    @Param('divisionId') divisionId: string,
    @Body() dto: CreateAspectDto,
  ) {
    return this.kpiService.createAspect(divisionId, dto, { userId: req.user.id, roles: req.user.roles });
  }

  @Put('aspects/:id')
  @UseGuards(RolesGuard)
  @Roles('CHR', 'HS', 'SPV')
  async updateAspect(@Request() req: ExpressRequest, @Param('id') id: string, @Body() dto: UpdateAspectDto) {
    return this.kpiService.updateAspect(id, dto, { userId: req.user.id, roles: req.user.roles });
  }

  // ---------- division config (default amount) ----------

  @Get('divisions/:divisionId/config')
  @UseGuards(RolesGuard)
  @Roles(...SCORERS)
  async getConfig(@Request() req: ExpressRequest, @Param('divisionId') divisionId: string) {
    await this.kpiService.assertDivisionScope(req.user.id, req.user.roles, divisionId);
    return this.kpiService.getConfig(divisionId);
  }

  @Put('divisions/:divisionId/config')
  @UseGuards(RolesGuard)
  @Roles('CHR', 'HS', 'SPV')
  async upsertConfig(
    @Request() req: ExpressRequest,
    @Param('divisionId') divisionId: string,
    @Body() dto: UpsertConfigDto,
  ) {
    return this.kpiService.upsertConfig(divisionId, dto, { userId: req.user.id, roles: req.user.roles });
  }

  // ---------- assign wizard ----------

  @Get('divisions/:divisionId/assign-context')
  @UseGuards(RolesGuard)
  @Roles('CHR', 'HS', 'SPV')
  async assignContext(@Request() req: ExpressRequest, @Param('divisionId') divisionId: string) {
    return this.kpiService.getAssignContext(divisionId, req.user.id, req.user.roles);
  }

  @Post('divisions/:divisionId/assign')
  @UseGuards(RolesGuard)
  @Roles('CHR', 'HS', 'SPV')
  async assignPeriod(
    @Request() req: ExpressRequest,
    @Param('divisionId') divisionId: string,
    @Body() dto: SaveGridDto,
  ) {
    return this.kpiService.assignPeriod(divisionId, dto, req.user.id, req.user.roles);
  }

  // ---------- scoring grid (edit) ----------

  @Get('divisions/:divisionId/grid')
  @UseGuards(RolesGuard)
  @Roles(...SCORERS)
  async getGrid(
    @Request() req: ExpressRequest,
    @Param('divisionId') divisionId: string,
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
  ) {
    await this.kpiService.assertDivisionScope(req.user.id, req.user.roles, divisionId);
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
    return this.kpiService.saveGrid(divisionId, dto, req.user.id, req.user.roles);
  }

  // ---------- HR approve (immutable + payroll gate) ----------

  @Post('divisions/:divisionId/approve')
  @UseGuards(RolesGuard)
  @Roles('CHR')
  async approvePeriod(
    @Request() req: ExpressRequest,
    @Param('divisionId') divisionId: string,
    @Body() body: { period_month: number; period_year: number },
  ) {
    return this.kpiService.approvePeriod(
      divisionId,
      body.period_month,
      body.period_year,
      req.user.id,
      req.user.roles,
    );
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
