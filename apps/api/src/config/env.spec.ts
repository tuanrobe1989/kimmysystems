import { describe, expect, it } from 'vitest';
import { validateEnv } from './env';

const valid = { DATABASE_URL: 'postgresql://kimmy:dev@localhost:5432/kimmysystem', REDIS_URL: 'redis://localhost:6379', S3_ENDPOINT: 'http://localhost:9000', S3_KEY: 'kimmy', S3_SECRET: 'devdevdev', SMTP_URL: 'smtp://localhost:1025', JWT_SECRET: 'dev-only-jwt-secret-change-in-production' };
describe('environment validation', () => {
  it('defaults port, mode, and token lifetimes', () => { expect(validateEnv(valid)).toMatchObject({ PORT: 4000, NODE_ENV: 'development', ACCESS_TOKEN_TTL_SECONDS: 900, REFRESH_TOKEN_TTL_DAYS: 30 }); });
  it('rejects a short JWT secret', () => { expect(() => validateEnv({ ...valid, JWT_SECRET: 'short' })).toThrow(/^Invalid environment: JWT_SECRET$/); });
  it.each(['0', '30.5', 'week'])('rejects invalid refresh TTL %s', (REFRESH_TOKEN_TTL_DAYS) => { expect(() => validateEnv({ ...valid, REFRESH_TOKEN_TTL_DAYS })).toThrow('REFRESH_TOKEN_TTL_DAYS'); });
  for (const key of Object.keys(valid)) {
    it(`requires ${key}`, () => { expect(() => validateEnv({ ...valid, [key]: undefined })).toThrow(key); });
  }
  it.each(['', 'zero', '0', '-1', '65536', '1.5'])('rejects invalid port %s', (PORT) => { expect(() => validateEnv({ ...valid, PORT })).toThrow('PORT'); });
  it.each(['http://localhost/db', 'file:///tmp/db', 'not-a-url'])('rejects invalid database URL', (DATABASE_URL) => { expect(() => validateEnv({ ...valid, DATABASE_URL })).toThrow('DATABASE_URL'); });
  it('does not disclose credentials in failures', () => { expect(() => validateEnv({ ...valid, S3_SECRET: 'secret' })).toThrow(/^Invalid environment: S3_SECRET$/); });
});
