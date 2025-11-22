import { PrismaClient } from '@prisma/client';

type GlobalPrisma = typeof globalThis & { prisma?: PrismaClient };

const globalForPrisma = globalThis as GlobalPrisma;

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
