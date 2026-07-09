import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { UnitsService } from './units.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import { CreateUnitDto, UpdateUnitDto, ListUnitsDto } from './dto';
@Controller('units')
@UseGuards(JwtAuthGuard)
export class UnitsController {
  constructor(private readonly s: UnitsService) {}
  @Get() @UseGuards(RolesGuard) @Roles('OWNER','CFO','MGR','CSO','CMO','SPV','HS','ASA') async findAll(@Query() q: ListUnitsDto) { return this.s.findAll(q); }
  @Get(':id') @UseGuards(RolesGuard) @Roles('OWNER','CFO','MGR','CSO','CMO','SPV','HS','ASA') async findById(@Param('id') id: string) { return this.s.findById(id); }
  @Post() @UseGuards(RolesGuard) @Roles('CSO','CMO','SPV','HS','ASA') @HttpCode(HttpStatus.CREATED) async create(@Body() dto: CreateUnitDto) { return this.s.create(dto); }
  @Put(':id') @UseGuards(RolesGuard) @Roles('CSO','CMO','SPV','HS','ASA') async update(@Param('id') id: string, @Body() dto: UpdateUnitDto) { return this.s.update(id, dto); }
  @Delete(':id') @UseGuards(RolesGuard) @Roles('CSO','SPV') @HttpCode(HttpStatus.NO_CONTENT) async delete(@Param('id') id: string) { await this.s.delete(id); }
}
