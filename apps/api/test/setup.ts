import 'reflect-metadata';
import 'dotenv/config';
const testUrl = new URL(process.env.TEST_DATABASE_URL ?? 'postgresql://kimmy:dev@localhost:5432/kimmysystem_test');
if (!testUrl.pathname.endsWith('_test')) throw new Error('Integration tests require a dedicated database ending in _test');
process.env.DATABASE_URL = testUrl.toString();
process.env.NODE_ENV = 'test';
