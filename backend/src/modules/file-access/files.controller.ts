import { Controller, Get, NotFoundException, Param, Query, StreamableFile } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { StorageService } from '../../shared/services/storage.service';
import { FileTokenService } from '../../shared/services/file-token.service';

/**
 * IGDERP-254: authenticated file bytes for private uploads.
 * The ?token= query IS the auth (short-lived HMAC, see FileTokenService) —
 * no session guard here because <a>/<img> cannot send Bearer headers.
 * Clients must use the signed contentUrl issued by list/detail endpoints,
 * never raw /uploads/* paths (static serve is removed).
 */
@Controller('files')
export class FilesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly tokens: FileTokenService,
  ) {}

  @Get(':kind/:id')
  async content(@Param('kind') kind: string, @Param('id') id: string, @Query('token') token: string) {
    if (kind !== 'purchase' && kind !== 'service-photo') throw new NotFoundException('File not found');
    this.tokens.verify(kind as 'purchase' | 'service-photo', id, token);

    let filePath: string;
    let mimeType: string;
    let fileName: string;
    if (kind === 'purchase') {
      const row = await this.prisma.purchaseAttachment.findUnique({ where: { id } });
      if (!row) throw new NotFoundException('File not found');
      filePath = row.filePath;
      mimeType = row.mimeType;
      fileName = row.fileName;
    } else {
      const row = await this.prisma.servicePhoto.findUnique({ where: { id } });
      if (!row) throw new NotFoundException('File not found');
      filePath = row.photoUrl;
      mimeType = row.photoUrl.endsWith('.png') ? 'image/png' : 'image/jpeg';
      fileName = row.photoUrl.split('/').pop() || `${id}.jpg`;
    }

    const bytes = this.storage.read(filePath);
    const safeName = (fileName || `${id}`).replace(/["\r\n]/g, '_');
    return new StreamableFile(bytes, {
      type: mimeType || 'application/octet-stream',
      disposition: `inline; filename="${safeName}"`,
    });
  }
}
