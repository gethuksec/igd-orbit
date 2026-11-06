import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { StorageService } from './storage.service';

describe('StorageService (IGDERP-254)', () => {
  let dir: string;
  let storage: StorageService;
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    dir = mkdtempSync(join(tmpdir(), 'storage-spec-'));
    process.env.STORAGE_PATH = dir;
    process.env.STORAGE_TYPE = 'local';
    storage = new StorageService();
  });

  afterEach(() => {
    process.env = OLD_ENV;
    rmSync(dir, { recursive: true, force: true });
  });

  it('defaults to the local driver', () => {
    delete process.env.STORAGE_TYPE;
    expect(new StorageService().driver()).toBe('local');
  });

  it('saves, reads, and removes round-trip', () => {
    const key = storage.save('purchase-docs', 'po1-123.pdf', Buffer.from('%PDF-1.4 test'));
    expect(key).toBe('/uploads/purchase-docs/po1-123.pdf');
    expect(existsSync(join(dir, 'purchase-docs', 'po1-123.pdf'))).toBe(true);
    expect(storage.read(key).toString()).toBe('%PDF-1.4 test');
    storage.remove(key);
    expect(existsSync(join(dir, 'purchase-docs', 'po1-123.pdf'))).toBe(false);
  });

  it('remove is best-effort on missing keys', () => {
    expect(() => storage.remove('/uploads/purchase-docs/nope.pdf')).not.toThrow();
  });

  it('rejects path traversal keys', () => {
    expect(() => storage.resolveFsPath('/uploads/../etc/passwd')).toThrow('Invalid storage key');
  });

  it('refuses work when STORAGE_TYPE=s3 without a driver (IGDERP-256)', () => {
    process.env.STORAGE_TYPE = 's3';
    expect(() => storage.save('x', 'a.pdf', Buffer.from('x'))).toThrow('S3 storage not configured');
  });
});
