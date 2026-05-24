import bcrypt from 'bcrypt';
import { env } from '../../config/env';

export function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, env.BCRYPT_SALT_ROUNDS);
}

export function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

/** Convert Buffer (stored as VARBINARY in MSSQL) → string สำหรับ bcrypt.compare */
export function bufferToHashString(buf: Buffer | string | null | undefined): string | null {
  if (!buf) return null;
  if (typeof buf === 'string') return buf;
  return buf.toString('utf8');
}
