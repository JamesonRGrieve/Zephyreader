// @vitest-environment node
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { prisma } from './prisma';

describe('prisma', () => {
  it('is one client, kept on globalThis outside production so a reload reuses it', () => {
    // Compared by reference: handing the client itself to a matcher walks Prisma's proxy without end.
    const kept = (globalThis as typeof globalThis & { prisma?: PrismaClient }).prisma;
    expect(kept === prisma).toBe(true);
    expect(typeof prisma.$transaction).toBe('function');
  });
});
