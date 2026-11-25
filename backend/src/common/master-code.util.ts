import { randomBytes } from 'crypto';

/**
 * Master-data code format (IGDERP-316): flat 10-char alphanumeric.
 * Replaces the legacy prefixed formats (CAT-/BRD-/CLR-/UNT-/SIZ- + 8 hex).
 * randomBytes(5) -> 10 uppercase hex chars, a strict subset of [A-Z0-9].
 */
export const MASTER_CODE_PATTERN = /^[A-Z0-9]{10}$/;

export function generateMasterCode(): string {
  return randomBytes(5).toString('hex').toUpperCase();
}
