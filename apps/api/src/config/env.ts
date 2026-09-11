import { z } from 'zod';

const protocol = (protocols: string[]) => z.string().url().refine(
  (value) => { try { return protocols.includes(new URL(value).protocol); } catch { return false; } },
  `Expected protocol: ${protocols.join(', ')}`,
);

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: protocol(['postgres:', 'postgresql:']),
  REDIS_URL: protocol(['redis:', 'rediss:']),
  S3_ENDPOINT: protocol(['http:', 'https:']),
  S3_KEY: z.string().min(1),
  S3_SECRET: z.string().min(8),
  SMTP_URL: protocol(['smtp:', 'smtps:']),
  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
});

export function validateEnv(input: Record<string, unknown>) {
  const result = envSchema.safeParse(input);
  // Report field names only; never print input values (credentials).
  if (!result.success) throw new Error(`Invalid environment: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`);
  return result.data;
}
