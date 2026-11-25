const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Generate a random 10-character alphanumeric code (A-Z, 0-9).
 * Used for master-data Kode fields (supplier, expedition, ...) — auto-generated,
 * user can regenerate via the Generate button; backend enforces uniqueness.
 */
export function generateCode10(): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** Validate the 10-char alphanumeric Kode format. */
export function isCode10(code: string): boolean {
  return /^[A-Z0-9]{10}$/.test(code);
}
