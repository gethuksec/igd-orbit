import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Request,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { PurchaseAttachmentsService } from './services/purchase-attachments.service';

interface ExpressRequest extends Request {
  user: { id: string; roles: string[] };
}

/**
 * IGDERP-81: supplier invoice / delivery-note documents for PurchaseOrder & GoodsReceipt.
 * Files land in volume-backed ./uploads/purchase-docs served at /uploads/*.
 */
@Controller('purchasing/attachments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'SPV', 'HS', 'SODO')
export class PurchaseAttachmentsController {
  constructor(private readonly attachmentsService: PurchaseAttachmentsService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('files', 10))
  async upload(
    @UploadedFiles() files: Array<{ originalname: string; mimetype: string; size: number; buffer: Buffer }>,
    @Body() body: { entityType: string; entityId: string; documentType: string },
    @Request() req: ExpressRequest,
  ) {
    return this.attachmentsService.upload(
      body.entityType,
      body.entityId,
      body.documentType || 'OTHER',
      files as any,
      req.user.id,
    );
  }

  @Get()
  async list(@Query('entityType') entityType: string, @Query('entityId') entityId: string) {
    return this.attachmentsService.list(entityType, entityId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: ExpressRequest) {
    return this.attachmentsService.remove(id, req.user.id);
  }
}
