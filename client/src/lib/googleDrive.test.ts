// @vitest-environment node
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The lite Google Drive module, held to the framework's provider
 * (zephyrex/extensions/cloud/BLL_Cloud_test.py, same fixtures and expectations): Drive's
 * file shapes, the query it builds, the refusals a user can act on, and a real call to
 * Google with a refused token when the network allows.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '~/lib/apiErrors';
import { encryptSecret } from '~/lib/auth/crypto';
import { prisma } from '~/lib/prisma';
import { accessToken, cloudFile, delegatedProvider, DRIVE_READONLY_SCOPE, fileQuery, listFiles } from './googleDrive';

const DRIVE_FILES = [
  {
    id: '1AbC-dEf_2',
    name: 'Keynote script',
    mimeType: 'application/vnd.google-apps.document',
    modifiedTime: '2026-10-30T18:04:11.512Z',
    starred: true,
  },
  { id: '9zz', name: 'notes.md', mimeType: 'text/markdown', modifiedTime: '2026-10-01T09:00:00.000Z', size: '2048' },
  { id: 'f0', name: 'Talks', mimeType: 'application/vnd.google-apps.folder', starred: false },
];

async function googleOnline(): Promise<boolean> {
  try {
    await fetch('https://www.googleapis.com', { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    return true;
  } catch {
    return false;
  }
}

function status(error: unknown): number | null {
  return error instanceof ApiError ? error.status : null;
}

describe('Drive shapes', () => {
  it('parses files with sizes, stars and folders', () => {
    expect(DRIVE_FILES.map(cloudFile)).toEqual([
      {
        path: '1AbC-dEf_2',
        name: 'Keynote script',
        mime_type: 'application/vnd.google-apps.document',
        modified_at: '2026-10-30T18:04:11.512Z',
        size: null,
        starred: true,
        is_folder: false,
      },
      {
        path: '9zz',
        name: 'notes.md',
        mime_type: 'text/markdown',
        modified_at: '2026-10-01T09:00:00.000Z',
        size: 2048,
        starred: false,
        is_folder: false,
      },
      {
        path: 'f0',
        name: 'Talks',
        mime_type: 'application/vnd.google-apps.folder',
        modified_at: null,
        size: null,
        starred: false,
        is_folder: true,
      },
    ]);
  });

  it('escapes a search and scopes a folder', () => {
    const query = fileQuery('f0', "Bob's \\ talk");
    expect(query).toContain("name contains 'Bob\\'s \\\\ talk'");
    expect(query).toContain("'f0' in parents");
    expect(query).toContain('trashed = false');
    expect(query).toContain("mimeType = 'application/vnd.google-apps.document'");
  });

  it('refuses a folder that is not a Drive id, and any other provider', () => {
    expect(() => fileQuery("x' or name contains '", null)).toThrow(ApiError);
    expect(() => delegatedProvider('nextcloud')).toThrow(ApiError);
    expect(() => delegatedProvider('google_drive')).not.toThrow();
  });
});

describe('the user’s Google sign-in', () => {
  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  async function user(scopes: string | null) {
    const created = await prisma.user.create({ data: { email: 'ada@example.com' } });
    if (scopes !== null) {
      await prisma.oAuthLink.create({
        data: {
          userId: created.id,
          provider: 'google',
          providerUserId: `google-${created.id}`,
          accessToken: encryptSecret('not-a-real-token'),
          tokenExpiresAt: new Date(Date.now() + 3_600_000),
          scopes,
        },
      });
    }
    return created.id;
  }

  it('is 409 when never signed in with Google and 403 without Drive access', async () => {
    expect(status(await accessToken(await user(null)).catch((error: unknown) => error))).toBe(409);
    await prisma.user.deleteMany();
    expect(status(await accessToken(await user('openid email profile')).catch((error: unknown) => error))).toBe(403);
  });

  it('lets Google decide once the scope is granted', async () => {
    const token = await accessToken(await user(`openid email ${DRIVE_READONLY_SCOPE}`));
    expect(token).toBe('not-a-real-token');
    if (!(await googleOnline())) return;
    expect(status(await listFiles(token, '', null).catch((error: unknown) => error))).toBe(403);
  });
});
