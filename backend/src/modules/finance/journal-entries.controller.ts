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
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { JournalEntriesService } from './services/journal-entries.service';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { UpdateJournalEntryDto } from './dto/update-journal-entry.dto';
import { ReverseJournalEntryDto } from './dto/reverse-journal-entry.dto';

@Controller('journal-entries')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JournalEntriesController {
  constructor(private readonly journalEntriesService: JournalEntriesService) {}

  /**
   * Create manual journal entry
   * POST /api/v1/journal-entries
   * Permissions: CFO, Finance Staff
   */
  @Post()
  @Roles('CFO', 'FINANCE')
  async create(@Body() dto: CreateJournalEntryDto, @Request() req: any) {
    return this.journalEntriesService.create(dto, req.user.id);
  }

  /**
   * List journal entries
   * GET /api/v1/journal-entries
   * Permissions: CFO, Finance Staff
   */
  @Get()
  @Roles('CFO', 'FINANCE', 'OWNER')
  async findAll(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('entryType') entryType?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.journalEntriesService.findAll({
      startDate,
      endDate,
      status,
      entryType,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /**
   * Get journal entry detail
   * GET /api/v1/journal-entries/:id
   * Permissions: CFO, Finance Staff
   */
  @Get(':id')
  @Roles('CFO', 'FINANCE', 'OWNER')
  async findById(@Param('id') id: string) {
    return this.journalEntriesService.findById(id);
  }

  /**
   * Update journal entry (only if draft)
   * PUT /api/v1/journal-entries/:id
   * Permissions: CFO, Finance Staff
   */
  @Put(':id')
  @Roles('CFO', 'FINANCE')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateJournalEntryDto,
    @Request() req: any,
  ) {
    return this.journalEntriesService.update(id, dto, req.user.id);
  }

  /**
   * Delete journal entry (only if draft)
   * DELETE /api/v1/journal-entries/:id
   * Permissions: CFO, Finance Staff
   */
  @Delete(':id')
  @Roles('CFO', 'FINANCE')
  async delete(@Param('id') id: string) {
    return this.journalEntriesService.delete(id);
  }

  /**
   * Post journal entry to ledger
   * POST /api/v1/journal-entries/:id/post
   * Permissions: CFO
   */
  @Post(':id/post')
  @Roles('CFO')
  async post(@Param('id') id: string, @Request() req: any) {
    return this.journalEntriesService.post(id, req.user.id);
  }

  /**
   * Reverse journal entry
   * POST /api/v1/journal-entries/:id/reverse
   * Permissions: CFO
   */
  @Post(':id/reverse')
  @Roles('CFO')
  async reverse(
    @Param('id') id: string,
    @Body() dto: ReverseJournalEntryDto,
    @Request() req: any,
  ) {
    return this.journalEntriesService.reverse(id, dto, req.user.id);
  }
}

