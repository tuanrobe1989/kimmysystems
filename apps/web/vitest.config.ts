import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['lib/**/*.spec.ts'], env: { API_URL: 'http://localhost:4000/api/v1' } } });
