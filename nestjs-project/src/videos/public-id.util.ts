import { randomBytes } from 'crypto';

const PUBLIC_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

// 8 random bytes (64 bits) encode to exactly 11 base64url characters.
export function generatePublicId(): string {
  return randomBytes(8).toString('base64url');
}

export function isPublicIdFormat(value: unknown): value is string {
  return typeof value === 'string' && PUBLIC_ID_PATTERN.test(value);
}
