import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = process.env.DEVICE_PASSWORD_SECRET || 'default-secret-key-change-in-production-32chars!!';
const IV_LENGTH = 16; // For AES, this is always 16

/**
 * Encrypt device password for secure storage
 */
export function encryptPassword(plainPassword: string): string {
  if (!plainPassword) {
    return '';
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(SECRET_KEY.slice(0, 32), 'utf8'),
    iv,
  );

  let encrypted = cipher.update(plainPassword, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Return IV + encrypted data (IV needed for decryption)
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt device password (only for authorized technicians)
 */
export function decryptPassword(encryptedPassword: string): string {
  if (!encryptedPassword) {
    return '';
  }

  try {
    const parts = encryptedPassword.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted password format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(SECRET_KEY.slice(0, 32), 'utf8'),
      iv,
    );

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error('Failed to decrypt password');
  }
}



