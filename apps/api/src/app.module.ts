import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env';
import { PrismaService } from './prisma.service';
import { HealthController } from './health.controller';
import { SitesController } from './sites/sites.controller';
import { SitesService } from './sites/sites.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })],
  controllers: [HealthController, SitesController],
  providers: [PrismaService, SitesService],
})
export class AppModule {}
