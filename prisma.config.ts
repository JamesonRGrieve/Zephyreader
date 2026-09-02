// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from 'prisma/config';

// Prisma 7 reads the connection URL for migrate/introspection commands from here.
// Runtime connections go through the driver adapter in src/lib/prisma.ts instead.
export default defineConfig({
  schema: 'schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL ?? 'file:./oauth2.db',
  },
});
