import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { CreateKPIDto } from '../dto/create-kpi.dto';
import { UpdateKPIScoreDto } from '../dto/update-kpi-score.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class KPIService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calculate KPI bonus based on score
   */
  calculateKPIBonus(kpiScore: Decimal, targetBonus: Decimal | null): {
    bonusAmount: Decimal;
    multiplier: Decimal;
  } {
    if (!targetBonus || targetBonus.equals(0)) {
      return { bonusAmount: new Decimal(0), multiplier: new Decimal(0) };
    }

    const score = kpiScore.toNumber();
    let multiplier: Decimal;

    if (score >= 90) {
      multiplier = new Decimal(1.5);
    } else if (score >= 80) {
      multiplier = new Decimal(1.2);
    } else if (score >= 70) {
      multiplier = new Decimal(1.0);
    } else if (score >= 60) {
      multiplier = new Decimal(0.8);
    } else {
      multiplier = new Decimal(0);
    }

    const bonusAmount = targetBonus.times(multiplier);

    return { bonusAmount, multiplier };
  }

  /**
   * Record KPI
   */
  async recordKPI(dto: CreateKPIDto, userId: string, userRoles: string[]) {
    // Check permission
    const hasPermission = ['HS', 'SPV', 'CHR'].some((role) => userRoles.includes(role));
    if (!hasPermission) {
      throw new ForbiddenException('Only HS, SPV, or CHR can record KPI');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employee_id },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // Check if KPI record already exists
    const existing = await this.prisma.kPIRecord.findUnique({
      where: {
        employeeId_periodMonth_periodYear: {
          employeeId: dto.employee_id,
          periodMonth: dto.period_month,
          periodYear: dto.period_year,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('KPI record already exists for this period');
    }

    // Get target bonus (would be configured per employee/position)
    const targetBonus = new Decimal(1000000); // Default, would come from employee config

    // Calculate bonus
    const { bonusAmount, multiplier } = this.calculateKPIBonus(
      new Decimal(dto.overall_score),
      targetBonus,
    );

    const kpiRecord = await this.prisma.kPIRecord.create({
      data: {
        employeeId: dto.employee_id,
        periodMonth: dto.period_month,
        periodYear: dto.period_year,
        salesTargetAchievement: dto.sales_target_achievement
          ? new Decimal(dto.sales_target_achievement)
          : null,
        serviceQualityScore: dto.service_quality_score
          ? new Decimal(dto.service_quality_score)
          : null,
        customerSatisfaction: dto.customer_satisfaction
          ? new Decimal(dto.customer_satisfaction)
          : null,
        attendanceScore: dto.attendance_score ? new Decimal(dto.attendance_score) : null,
        overallScore: new Decimal(dto.overall_score),
        targetBonus,
        calculatedBonus: bonusAmount,
        bonusMultiplier: multiplier,
        recordedBy: userId,
        notes: dto.notes,
      },
      include: {
        employee: {
          include: { user: true },
        },
      },
    });

    return kpiRecord;
  }

  /**
   * Update KPI score
   */
  async updateScore(
    kpiId: string,
    dto: UpdateKPIScoreDto,
    _userId: string,
    userRoles: string[],
  ) {
    // Check permission
    const hasPermission = ['HS', 'SPV', 'CHR'].some((role) => userRoles.includes(role));
    if (!hasPermission) {
      throw new ForbiddenException('Only HS, SPV, or CHR can update KPI score');
    }

    const kpiRecord = await this.prisma.kPIRecord.findUnique({
      where: { id: kpiId },
    });

    if (!kpiRecord) {
      throw new NotFoundException('KPI record not found');
    }

    // Recalculate bonus
    const { bonusAmount, multiplier } = this.calculateKPIBonus(
      new Decimal(dto.overall_score),
      kpiRecord.targetBonus,
    );

    const updated = await this.prisma.kPIRecord.update({
      where: { id: kpiId },
      data: {
        overallScore: new Decimal(dto.overall_score),
        calculatedBonus: bonusAmount,
        bonusMultiplier: multiplier,
        updatedAt: new Date(),
      },
      include: {
        employee: {
          include: { user: true },
        },
      },
    });

    return updated;
  }

  /**
   * Get employee KPIs
   */
  async getEmployeeKPIs(employeeId: string, periodMonth?: number, periodYear?: number) {
    const where: any = { employeeId };

    if (periodMonth) {
      where.periodMonth = periodMonth;
    }

    if (periodYear) {
      where.periodYear = periodYear;
    }

    return this.prisma.kPIRecord.findMany({
      where,
      include: {
        employee: {
          include: { user: true },
        },
      },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    });
  }

  /**
   * Get KPI record by ID
   */
  async findById(id: string) {
    const kpiRecord = await this.prisma.kPIRecord.findUnique({
      where: { id },
      include: {
        employee: {
          include: { user: true, branch: true, department: true },
        },
      },
    });

    if (!kpiRecord) {
      throw new NotFoundException('KPI record not found');
    }

    return kpiRecord;
  }
}

