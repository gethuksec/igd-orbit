import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { isAbsolute, join, resolve, sep } from 'path';

// IGDERP-254: storage seam. All upload bytes go through here so the
// MinIO move (IGDERP-256) is a driver swap, not a rewrite.
// STORAGE_TYPE=local (default) | s3. STORAGE_PATH honors the compose env
// (defaults to ./uploads relative to cwd). Saved keys keep the legacy
// `/uploads/<subdir>/<file>` shape so existing DB rows need no migration.
@Injectable()
export class StorageService {
  driver(): 'local' | 's3' {
    return process.env.STORAGE_TYPE === 's3' ? 's3' : 'local';
  }

  baseDir(): string {
    const p = process.env.STORAGE_PATH || join(process.cwd(), 'uploads');
    return isAbsolute(p) ? p : resolve(process.cwd(), p);
  }

  /** Persist buffer, return the public key (legacy `/uploads/...` shape). */
  save(subdir: string, filename: string, buffer: Buffer): string {
    this.assertLocal();
    const safeSub = subdir.replace(/[^a-z0-9-]/gi, '') || 'misc';
    const safeName = filename.split('/').pop() || `file-${Date.now()}`;
    const dir = join(this.baseDir(), safeSub);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, safeName), buffer);
    return `/uploads/${safeSub}/${safeName}`;
  }

  read(publicPath: string): Buffer {
    this.assertLocal();
    return readFileSync(this.resolveFsPath(publicPath));
  }

  /** Best-effort delete — a missing file is not an error (row is the truth). */
  remove(publicPath: string): void {
    this.assertLocal();
    try {
      const full = this.resolveFsPath(publicPath);
      if (existsSync(full)) unlinkSync(full);
    } catch {
      // ignore cleanup errors
    }
  }

  resolveFsPath(publicPath: string): string {
    const rel = (publicPath || '').replace(/^\/uploads\//, '');
    if (!rel || rel.includes('..')) throw new Error('Invalid storage key: ' + publicPath);
    return join(this.baseDir(), ...rel.split('/'));
  }

  private assertLocal(): void {
    if (this.driver() !== 'local') {
      throw new ServiceUnavailableException('S3 storage not configured (see IGDERP-256)');
    }
  }
}

// Re-exported for tests that want the path separator behaviour explicit.
export const STORAGE_SEP = sep;
