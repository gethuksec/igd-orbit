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
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { DepartmentsService } from './services/departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Controller('departments')
@UseGuards(JwtAuthGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    if (page || limit) {
      const pageNum = page ? parseInt(page) : 1;
      const limitNum = limit ? parseInt(limit) : 20;
      return await this.departmentsService.findAllPaginated(
        pageNum,
        limitNum,
        search,
      );
    }
    return await this.departmentsService.findAll();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return await this.departmentsService.findById(id);
  }

  @Post()
  async create(@Body() dto: CreateDepartmentDto) {
    return await this.departmentsService.create(dto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return await this.departmentsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return await this.departmentsService.remove(id);
  }
}
