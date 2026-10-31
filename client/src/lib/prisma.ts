// SPDX-License-Identifier: AGPL-3.0-or-later
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';

// Prisma 7 connects through a driver adapter rather than a bundled query engine.
// The sqlite file matches the datasource that was previously inlined in the schema.
const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./oauth2.db' });

// Reuse a single client across hot-reloads in development to avoid exhausting
// connections (each `new PrismaClient` opens its own adapter connection).
const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
