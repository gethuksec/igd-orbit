import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PenaltyTypesService } from './penalty-types.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import { CreatePenaltyTypeDto, UpdatePenaltyTypeDto, ListPenaltyTypesDto } from './dto';

/**
 * Penalty Types Controller (IGDERP-261)
 * HR master-data endpoints
 */
@Controller('penalty-types')
@UseGuards(JwtAuthGuard)
export class PenaltyTypesController {
  constructor(private readonly svc: PenaltyTypesService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OWNER', 'HR', 'SPV-HRD', 'MS', 'HS')
  async findAll(@Query() query: ListPenaltyTypesDto) {
    try {
      return await this.svc.findAll(query);
    } catch (error) {
      console.error('Error in penaltyType.findAll:', error);
      throw error;
    }
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OWNER', 'HR', 'SPV-HRD', 'MS', 'HS')
  async findById(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OWNER', 'HR', 'SPV-HRD', 'MS')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreatePenaltyTypeDto) {
    return this.svc.create(dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OWNER', 'HR', 'SPV-HRD', 'MS')
  async update(@Param('id') id: string, @Body() dto: UpdatePenaltyTypeDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OWNER', 'HR', 'SPV-HRD', 'MS')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.svc.delete(id);
  }
}
