import { Injectable, ForbiddenException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

// IGDERP-254: short-lived signed URLs for private files.
// Frontend auth is a Bearer header (localStorage) which <a>/<img> cannot
// send, so file bytes are served at GET /api/v1/files/:kind/:id?token=...
// where the token IS the auth. Secret: FILE_TOKEN_SECRET, else JWT_SECRET.
// Payload: kind.id.exp, HMAC-SHA256 hex.
export type FileKind = 'purchase' | 'service-photo';

const TOKEN_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class FileTokenService {
  private secret(): string {
    return process.env.FILE_TOKEN_SECRET || process.env.JWT_SECRET || 'dev-file-token-secret';
  }

  /** Build the path (under the global /api/v1 prefix) the frontend should use. */
  contentUrl(kind: FileKind, id: string): string {
    return `/api/v1/files/${kind}/${id}?token=${this.sign(kind, id)}`;
  }

  sign(kind: FileKind, id: string, ttlMs = TOKEN_TTL_MS): string {
    const exp = Date.now() + ttlMs;
    const body = `${kind}.${id}.${exp}`;
    const sig = createHmac('sha256', this.secret()).update(body).digest('hex');
    return `${body}.${sig}`;
  }

  verify(kind: FileKind, id: string, token: string): void {
    const parts = (token || '').split('.');
    if (parts.length !== 4) throw new ForbiddenException('Invalid file token');
    const [tokKind, tokId, expStr, sig] = parts;
    if (tokKind !== kind || tokId !== id) throw new ForbiddenException('Invalid file token');
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || Date.now() > exp) throw new ForbiddenException('File link expired');
    const expected = createHmac('sha256', this.secret()).update(`${tokKind}.${tokId}.${expStr}`).digest();
    const actual = Buffer.from(sig, 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new ForbiddenException('Invalid file token');
    }
  }
}
