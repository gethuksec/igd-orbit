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
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { ServiceReturnsService } from './service-returns.service';
import { CreateServiceReturnDto } from './dto/create-service-return.dto';
import { UpdateServiceReturnDto } from './dto/update-service-return.dto';
import { ApproveServiceReturnDto } from './dto/approve-service-return.dto';
import { RejectServiceReturnDto } from './dto/reject-service-return.dto';
import { CreateReServiceDto } from './dto/create-re-service.dto';

@Controller('service-returns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceReturnsController {
  constructor(private readonly serviceReturnsService: ServiceReturnsService) {}

  @Post()
  @Roles('CS', 'CR', 'HS', 'SPV', 'CMO', 'CSO')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateServiceReturnDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return this.serviceReturnsService.create(dto, req.user.id);
  }

  @Get()
  @Roles('CS', 'CR', 'HS', 'SPV', 'CMO', 'CSO', 'OWNER', 'CFO', 'MANAGER')
  async findAll(@Query() query: any) {
    return this.serviceReturnsService.findAll(query);
  }

  @Get(':id')
  @Roles('CS', 'CR', 'HS', 'SPV', 'CMO', 'CSO', 'OWNER', 'CFO', 'MANAGER')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.serviceReturnsService.findById(id);
  }

  @Put(':id')
  @Roles('CS', 'CR', 'HS', 'SPV', 'CMO', 'CSO')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceReturnDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return this.serviceReturnsService.update(id, dto, req.user.id);
  }

  @Post(':id/approve')
  @Roles('HS', 'SPV', 'CMO', 'CSO')
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveServiceReturnDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return this.serviceReturnsService.approve(id, dto, req.user.id);
  }

  @Post(':id/reject')
  @Roles('HS', 'SPV', 'CMO', 'CSO')
  @HttpCode(HttpStatus.OK)
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectServiceReturnDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return this.serviceReturnsService.reject(id, dto, req.user.id);
  }

  @Post(':id/re-service')
  @Roles('HS', 'SPV', 'CMO', 'CSO')
  @HttpCode(HttpStatus.CREATED)
  async createReService(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReServiceDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return this.serviceReturnsService.createReService(id, dto, req.user.id);
  }

  @Post(':id/resolve')
  @Roles('HS', 'SPV', 'CMO', 'CSO')
  @HttpCode(HttpStatus.OK)
  async resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return this.serviceReturnsService.resolve(id, req.user.id);
  }
}

