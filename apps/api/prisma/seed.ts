import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { seedDatabase } from './seed-data';

const prisma = new PrismaClient();
seedDatabase(prisma)
  .then(() => console.log('Seeded kimmyphungmakeup and demo.'))
  .catch(() => { console.error('Seed failed. Check database availability and migrations.'); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
