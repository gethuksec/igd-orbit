import { Controller, Get, NotFoundException, Param, Query, StreamableFile } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { StorageService } from '../../shared/services/storage.service';
import { FileTokenService, FileKind } from '../../shared/services/file-token.service';

/**
 * IGDERP-254: authenticated file bytes for private uploads.
 * The ?token= query IS the auth (short-lived HMAC, see FileTokenService) —
 * no session guard here because <a>/<img> cannot send Bearer headers.
 * Clients must use the signed contentUrl issued by list/detail endpoints,
 * never raw /uploads/* paths (static serve is removed).
 *
 * Attendance selfies: attendance rows carry two photo columns (clock-in/out),
 * not one row per file like purchase/service-photo — so the id binds the side:
 * GET /api/v1/files/attendance/:attendanceId:in|out?token=...
 * (the side is part of the signed id, so it cannot be swapped).
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
    if (kind !== 'purchase' && kind !== 'service-photo' && kind !== 'attendance')
      throw new NotFoundException('File not found');
    this.tokens.verify(kind as FileKind, id, token);

    let filePath: string;
    let mimeType: string;
    let fileName: string;
    if (kind === 'purchase') {
      const row = await this.prisma.purchaseAttachment.findUnique({ where: { id } });
      if (!row) throw new NotFoundException('File not found');
      filePath = row.filePath;
      mimeType = row.mimeType;
      fileName = row.fileName;
    } else if (kind === 'attendance') {
      // id = `<attendanceId>:in|out` (side bound by the signed token).
      const sep = id.lastIndexOf(':');
      const attendanceId = sep > 0 ? id.slice(0, sep) : id;
      const side = sep > 0 ? id.slice(sep + 1) : '';
      if (side !== 'in' && side !== 'out') throw new NotFoundException('File not found');
      const row = await this.prisma.attendance.findUnique({ where: { id: attendanceId } });
      const stored = side === 'in' ? row?.clockInPhotoUrl : row?.clockOutPhotoUrl;
      if (!row || !stored) throw new NotFoundException('File not found');
      filePath = stored;
      mimeType = stored.endsWith('.png') ? 'image/png' : 'image/jpeg';
      fileName = stored.split('/').pop() || `${attendanceId}-${side}.jpg`;
    } else {
      const row = await this.prisma.servicePhoto.findUnique({ where: { id } });
      if (!row) throw new NotFoundException('File not found');
      filePath = row.photoUrl;
      mimeType = row.photoUrl.endsWith('.png') ? 'image/png' : 'image/jpeg';
      fileName = row.photoUrl.split('/').pop() || `${id}.jpg`;
    }

    // A row whose bytes were deleted from disk is a 404, not a 500.
    let bytes: Buffer;
    try {
      bytes = this.storage.read(filePath);
    } catch {
      throw new NotFoundException('File not found');
    }
    const safeName = (fileName || `${id}`).replace(/["\r\n]/g, '_');
    return new StreamableFile(bytes, {
      type: mimeType || 'application/octet-stream',
      disposition: `inline; filename="${safeName}"`,
    });
  }
}
