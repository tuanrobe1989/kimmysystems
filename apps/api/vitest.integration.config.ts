import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
export default defineConfig({ plugins: [swc.vite()], test: { include: ['test/**/*.integration.ts'], setupFiles: ['test/setup.ts'], testTimeout: 15000, hookTimeout: 30000, fileParallelism: false } });
