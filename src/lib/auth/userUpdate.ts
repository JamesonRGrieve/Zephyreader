// SPDX-License-Identifier: AGPL-3.0-or-later
import { Prisma, type User } from '@prisma/client';
import { nextUpdateStamp } from '~/lib/conditionalRequest';
import { prisma } from '~/lib/prisma';

/** Prisma's "the row the where clause named was not found" code. */
const RECORD_NOT_FOUND = 'P2025';

/**
 * Writes the changes only if the row still carries the `updated_at` the caller
 * read, so a save landing in between is never overwritten; null if one did.
 * Stamps a fresh, strictly later `updated_at` on success.
 */
export async function updateUserUnlessModified(user: User, changes: Prisma.UserUpdateInput): Promise<User | null> {
  try {
    return await prisma.user.update({
      where: { id: user.id, updatedAt: user.updatedAt },
      data: { ...changes, updatedAt: nextUpdateStamp(user.updatedAt) },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === RECORD_NOT_FOUND) {
      return null;
    }
    throw error;
  }
}
