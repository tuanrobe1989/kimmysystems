import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.listen(app.get(ConfigService).getOrThrow<number>('PORT'), '127.0.0.1');
}
bootstrap().catch(() => { console.error('API startup failed. Check service availability and environment configuration.'); process.exitCode = 1; });
