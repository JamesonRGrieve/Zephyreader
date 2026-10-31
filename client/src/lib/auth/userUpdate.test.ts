// @vitest-environment node
// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '~/lib/prisma';
import { updateUserUnlessModified } from './userUpdate';

beforeEach(async () => {
  await prisma.user.deleteMany();
});

describe('updateUserUnlessModified', () => {
  it('writes the changes and stamps a later updated_at', async () => {
    const user = await prisma.user.create({ data: { email: 'ada@example.com', firstName: 'Ada' } });
    const updated = await updateUserUnlessModified(user, { firstName: 'Augusta' });
    expect(updated?.firstName).toBe('Augusta');
    expect(updated?.updatedAt.getTime()).toBeGreaterThan(user.updatedAt.getTime());
  });

  it('refuses, untouched, when another save landed after the caller read the row', async () => {
    const read = await prisma.user.create({ data: { email: 'ada@example.com', firstName: 'Ada' } });
    expect(await updateUserUnlessModified(read, { firstName: 'First' })).not.toBeNull();
    expect(await updateUserUnlessModified(read, { firstName: 'Second' })).toBeNull();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: read.id } })).firstName).toBe('First');
  });

  it('rethrows errors other than the stale-row miss', async () => {
    const user = await prisma.user.create({ data: { email: 'ada@example.com' } });
    await prisma.user.create({ data: { email: 'taken@example.com' } });
    await expect(updateUserUnlessModified(user, { email: 'taken@example.com' })).rejects.toThrow();
  });
});
