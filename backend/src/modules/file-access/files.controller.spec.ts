import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { FilesController } from './files.controller';
import { PrismaService } from '../../shared/services/prisma.service';
import { StorageService } from '../../shared/services/storage.service';
import { FileTokenService } from '../../shared/services/file-token.service';

describe('FilesController (IGDERP-254, http)', () => {
  let app: INestApplication<App>;
  let prisma: { purchaseAttachment: { findUnique: jest.Mock }; servicePhoto: { findUnique: jest.Mock } };
  let storage: { read: jest.Mock };
  let tokens: { verify: jest.Mock };

  beforeEach(async () => {
    prisma = {
      purchaseAttachment: { findUnique: jest.fn().mockResolvedValue(null) },
      servicePhoto: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    storage = { read: jest.fn().mockReturnValue(Buffer.from('%PDF-1.4 bytes')) };
    tokens = { verify: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
        { provide: FileTokenService, useValue: tokens },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('streams purchase bytes with content-type on a valid token', async () => {
    prisma.purchaseAttachment.findUnique.mockResolvedValue({
      id: 'att-1',
      filePath: '/uploads/purchase-docs/x.pdf',
      fileName: 'invoice.pdf',
      mimeType: 'application/pdf',
    });
    const res = await request(app.getHttpServer()).get('/files/purchase/att-1?token=good');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(tokens.verify).toHaveBeenCalledWith('purchase', 'att-1', 'good');
  });

  it('rejects tampered tokens without touching storage', async () => {
    tokens.verify.mockImplementation(() => {
      throw new (require('@nestjs/common').ForbiddenException)('Invalid file token');
    });
    const res = await request(app.getHttpServer()).get('/files/purchase/att-1?token=bad');
    expect(res.status).toBe(403);
    expect(storage.read).not.toHaveBeenCalled();
  });

  it('404s unknown ids and unknown kinds', async () => {
    const res = await request(app.getHttpServer()).get('/files/purchase/missing?token=t');
    expect(res.status).toBe(404);
    const res2 = await request(app.getHttpServer()).get('/files/nope/x?token=t');
    expect(res2.status).toBe(404);
  });
});
