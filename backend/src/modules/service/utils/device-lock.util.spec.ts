import { validateDeviceLock } from './device-lock.util';
import { encryptPassword, decryptPassword } from './password-encryption.util';

const TEST_SECRET = 'test-secret-0123456789abcdef-test';

describe('device lock utils (IGDERP-185)', () => {
  beforeEach(() => {
    process.env.DEVICE_PASSWORD_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.DEVICE_PASSWORD_SECRET;
  });

  it('accepts none without a credential', () => {
    expect(validateDeviceLock(undefined, undefined)).toBe('none');
    expect(validateDeviceLock('none', '')).toBe('none');
  });

  it('rejects credential without a lock type', () => {
    expect(() => validateDeviceLock('none', 'secret')).toThrow('tanpa jenis kunci');
  });

  it('rejects unknown lock types', () => {
    expect(() => validateDeviceLock('face-id', 'x')).toThrow('tidak valid');
  });

  it('requires a value for password/pin/pattern', () => {
    expect(() => validateDeviceLock('password', '')).toThrow('wajib diisi');
    expect(() => validateDeviceLock('pin', undefined)).toThrow('wajib diisi');
    expect(() => validateDeviceLock('pattern', '   ')).toThrow('wajib diisi');
  });

  it('validates PIN shape (4-8 digits)', () => {
    expect(validateDeviceLock('pin', '2901')).toBe('pin');
    expect(() => validateDeviceLock('pin', '12')).toThrow('4-8 digit');
    expect(() => validateDeviceLock('pin', '12ab')).toThrow('4-8 digit');
    expect(() => validateDeviceLock('pin', '123456789')).toThrow('4-8 digit');
  });

  it('validates pattern shape (4-9 unique nodes 0-8)', () => {
    expect(validateDeviceLock('pattern', 'pattern:0-3-4-5-8')).toBe('pattern');
    expect(() => validateDeviceLock('pattern', 'pattern:0-3-4')).toThrow('tidak valid');
    expect(() => validateDeviceLock('pattern', 'pattern:0-3-9')).toThrow('tidak valid');
    expect(() => validateDeviceLock('pattern', 'pattern:0-3-3-4')).toThrow('mengulang');
    expect(() => validateDeviceLock('pattern', '0-3-4-5')).toThrow('tidak valid');
  });

  it('round-trips each credential kind through AES', () => {
    for (const v of ['S4msung#21', '2901', 'pattern:0-3-4-5-8']) {
      expect(decryptPassword(encryptPassword(v))).toBe(v);
    }
  });

  it('fails fast when DEVICE_PASSWORD_SECRET is missing', () => {
    delete process.env.DEVICE_PASSWORD_SECRET;
    expect(() => encryptPassword('x')).toThrow('DEVICE_PASSWORD_SECRET is not set');
    expect(() => decryptPassword('a:b')).toThrow();
  });
});
