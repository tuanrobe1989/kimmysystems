import { expect, it } from 'vitest';
import { HealthController } from './health.controller';
it('reports liveness and a nonnegative uptime', () => {
  const result = new HealthController().health();
  expect(result.status).toBe('ok');
  expect(result.uptime).toBeGreaterThanOrEqual(0);
});
