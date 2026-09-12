import { BadRequestException } from '@nestjs/common';

// IGDERP-185: customer phone lock-screen credential types.
// Stored encrypted in ServiceOrder.devicePassword regardless of kind:
// - password: raw text (max 128 chars)
// - pin: 4-8 digits
// - pattern: drawn node sequence 'pattern:0-3-4-5-8' (3x3 grid, nodes 0-8, min 4, no repeats)
export const DEVICE_LOCK_TYPES = ['none', 'password', 'pin', 'pattern'] as const;
export type DeviceLockType = (typeof DEVICE_LOCK_TYPES)[number];

const PATTERN_RE = /^pattern:([0-8]-){3,8}[0-8]$/;

export function validateDeviceLock(
  lockType: string | undefined | null,
  password: string | undefined | null,
): DeviceLockType {
  const t = lockType ?? 'none';
  if (!(DEVICE_LOCK_TYPES as readonly string[]).includes(t)) {
    throw new BadRequestException('Jenis kunci tidak valid (none/password/pin/pattern)');
  }
  const pw = (password ?? '').trim();
  if (t === 'none') {
    if (pw) {
      throw new BadRequestException('Kunci layar terisi tanpa jenis kunci');
    }
    return t as DeviceLockType;
  }
  if (!pw) {
    throw new BadRequestException('Kunci layar wajib diisi');
  }
  if (t === 'pin' && !/^[0-9]{4,8}$/.test(pw)) {
    throw new BadRequestException('PIN harus 4-8 digit angka');
  }
  if (t === 'password' && pw.length > 128) {
    throw new BadRequestException('Password maksimal 128 karakter');
  }
  if (t === 'pattern') {
    if (!PATTERN_RE.test(pw)) {
      throw new BadRequestException('Format pola tidak valid');
    }
    const nodes = pw.replace(/^pattern:/, '').split('-');
    if (new Set(nodes).size !== nodes.length) {
      throw new BadRequestException('Pola tidak boleh mengulang titik');
    }
  }
  return t as DeviceLockType;
}
