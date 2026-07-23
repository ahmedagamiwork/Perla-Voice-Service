import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: z.enum(['true', 'false']).default('false').transform(v => v === 'true'),
  VOICE_API_TOKEN: z.string().min(24),
  ADMIN_API_TOKEN: z.string().min(24),
  PII_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/, 'must be exactly 64 hex characters'),
  ALLOWED_ORIGINS: z.string().default(''),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'),
  ENABLE_WRITE_TOOLS: z.enum(['true', 'false']).default('false').transform(v => v === 'true'),
  LOG_LEVEL: z.string().default('info')
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = {
  ...parsed.data,
  allowedOrigins: parsed.data.ALLOWED_ORIGINS.split(',').map(v => v.trim()).filter(Boolean)
};
