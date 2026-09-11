import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env';
import { PrismaService } from './prisma.service';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health.controller';
import { SitesController } from './sites/sites.controller';
import { SitesService } from './sites/sites.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }), AuthModule],
  controllers: [HealthController, SitesController],
  providers: [PrismaService, SitesService],
})
export class AppModule {}
