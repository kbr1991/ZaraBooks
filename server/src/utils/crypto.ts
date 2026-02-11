/**
 * Encryption utilities for sensitive data storage
 *
 * Uses AES-256-GCM for encrypting credentials before database storage.
 * Requires ENCRYPTION_KEY env variable (32 bytes hex-encoded, 64 chars).
 * Falls back to a derived key from SESSION_SECRET if ENCRYPTION_KEY is not set.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey && envKey.length === 64) {
    return Buffer.from(envKey, 'hex');
  }

  // Derive a key from SESSION_SECRET as fallback
  const secret = process.env.SESSION_SECRET || 'zarabooks-default-secret';
  return crypto.scryptSync(secret, 'zarabooks-salt', 32);
}

/**
 * Encrypt a string value using AES-256-GCM
 * Returns a base64 string containing IV + ciphertext + auth tag
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();

  // Combine IV + encrypted data + auth tag
  const combined = Buffer.concat([iv, encrypted, tag]);
  return combined.toString('base64');
}

/**
 * Decrypt a base64 string that was encrypted with encrypt()
 */
export function decrypt(encryptedBase64: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedBase64, 'base64');

  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(combined.length - TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Encrypt a JSON object
 */
export function encryptJSON(data: unknown): string {
  return encrypt(JSON.stringify(data));
}

/**
 * Decrypt to a JSON object
 */
export function decryptJSON<T = unknown>(encryptedBase64: string): T {
  return JSON.parse(decrypt(encryptedBase64)) as T;
}
