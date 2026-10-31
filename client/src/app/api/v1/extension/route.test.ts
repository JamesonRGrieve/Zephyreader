// @vitest-environment node
// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { issueSession } from '~/lib/auth/session';
import { prisma } from '~/lib/prisma';
import { GET } from './route.lite';

beforeEach(async () => {
  await prisma.user.deleteMany();
});

describe('GET /api/v1/extension', () => {
  it('401s an anonymous caller, like the server (AuthType.JWT)', async () => {
    const res = await GET(new NextRequest('http://localhost/api/v1/extension'));
    expect(res.status).toBe(401);
  });

  it('returns an empty extension list to a signed-in caller', async () => {
    const user = await prisma.user.create({ data: { email: 'ext@example.com' } });
    const { token } = await issueSession(user, 'oauth_consumer');
    const res = await GET(
      new NextRequest('http://localhost/api/v1/extension', { headers: { authorization: `Bearer ${token}` } }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ extensions: [] });
  });
});
