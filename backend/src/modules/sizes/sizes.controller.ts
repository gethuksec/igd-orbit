import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { SizesService } from './sizes.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import { CreateSizeDto, UpdateSizeDto, ListSizesDto } from './dto';
@Controller('sizes')
@UseGuards(JwtAuthGuard)
export class SizesController {
  constructor(private readonly s: SizesService) {}
  @Get() @UseGuards(RolesGuard) @Roles('OWNER','CFO','MGR','CSO','CMO','SPV','HS','ASA') async findAll(@Query() q: ListSizesDto) { return this.s.findAll(q); }
  @Get(':id') @UseGuards(RolesGuard) @Roles('OWNER','CFO','MGR','CSO','CMO','SPV','HS','ASA') async findById(@Param('id') id: string) { return this.s.findById(id); }
  @Post() @UseGuards(RolesGuard) @Roles('CSO','CMO','SPV','HS','ASA') @HttpCode(HttpStatus.CREATED) async create(@Body() dto: CreateSizeDto) { return this.s.create(dto); }
  @Put(':id') @UseGuards(RolesGuard) @Roles('CSO','CMO','SPV','HS','ASA') async update(@Param('id') id: string, @Body() dto: UpdateSizeDto) { return this.s.update(id, dto); }
  @Delete(':id') @UseGuards(RolesGuard) @Roles('CSO','SPV') @HttpCode(HttpStatus.NO_CONTENT) async delete(@Param('id') id: string) { await this.s.delete(id); }
}
