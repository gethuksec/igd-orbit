import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { StorageService } from '../../shared/services/storage.service';
import { FileTokenService } from '../../shared/services/file-token.service';
import { FilesController } from './files.controller';

/** IGDERP-254: signed-URL file bytes (see FilesController). */
@Module({
  providers: [PrismaService, StorageService, FileTokenService],
  controllers: [FilesController],
})
export class FileAccessModule {}
