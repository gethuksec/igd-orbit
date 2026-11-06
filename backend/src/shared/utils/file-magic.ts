import { BadRequestException } from '@nestjs/common';

// IGDERP-253: magic-byte validation for uploads.
// Mimetype strings are client-controlled, so verify actual file content
// before persisting. Callers still enforce their own mime allow-list;
// unknown mimetypes here pass through untouched.
const SIGNATURES: Record<string, { bytes: number[] }[]> = {
  'application/pdf': [{ bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  'image/jpeg': [{ bytes: [0xff, 0xd8, 0xff] }], // SOI marker
  'image/png': [{ bytes: [0x89, 0x50, 0x4e, 0x47] }], // .PNG
};

export function assertFileMagic(buffer: Buffer, mimetype: string, fileName: string): void {
  const sigs = SIGNATURES[mimetype];
  if (!sigs || !buffer || buffer.length < 4) {
    if (sigs) {
      throw new BadRequestException(`Isi file tidak sesuai tipe ${mimetype}: ${fileName || 'tanpa nama'}`);
    }
    return;
  }
  const ok = sigs.some((s) => s.bytes.every((b, i) => buffer[i] === b));
  if (!ok) {
    throw new BadRequestException(`Isi file tidak sesuai tipe ${mimetype}: ${fileName || 'tanpa nama'}`);
  }
}
