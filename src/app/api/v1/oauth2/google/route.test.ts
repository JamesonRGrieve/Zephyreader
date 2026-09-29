// @vitest-environment node
// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { POST } from './route';

describe('POST /api/v1/oauth2/google', () => {
  it('returns 400 when the body carries no authorization code', async () => {
    const res = await POST(
      new NextRequest('http://localhost/api/v1/oauth2/google', { method: 'POST', body: JSON.stringify({}) }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Missing authorization code' });
  });
});
