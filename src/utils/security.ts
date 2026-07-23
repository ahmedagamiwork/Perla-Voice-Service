import crypto from 'node:crypto';
import { env } from '../config/env.js';

const key = Buffer.from(env.PII_ENCRYPTION_KEY, 'hex');

export function safeTokenEqual(expected: string, actual?: string): boolean {
  if (!actual) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function extractBearer(header?: string): string | undefined {
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}

export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length === 10) digits = `966${digits.slice(1)}`;
  return digits;
}

export function hashPhone(input: string): string {
  return crypto.createHmac('sha256', key).update(normalizePhone(input)).digest('hex');
}

export function encryptText(value?: string | null): string | null {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map(b => b.toString('base64url')).join('.');
}

export function decryptText(value?: string | null): string | null {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 3) throw new Error('Invalid encrypted value');
  const [ivPart, tagPart, encryptedPart] = parts;
  if (!ivPart || !tagPart || !encryptedPart) throw new Error('Invalid encrypted value');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64url')),
    decipher.final()
  ]).toString('utf8');
}

export function redactForAudit(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input;
  const sensitive = new Set(['phone', 'customer_phone', 'customer_name', 'delivery_address', 'authorization']);
  if (Array.isArray(input)) return input.map(redactForAudit);
  return Object.fromEntries(Object.entries(input as Record<string, unknown>).map(([k, v]) => [
    k,
    sensitive.has(k.toLowerCase()) ? '[REDACTED]' : redactForAudit(v)
  ]));
}

export function generateReference(prefix: string): string {
  const day = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `${prefix}-${day}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}
