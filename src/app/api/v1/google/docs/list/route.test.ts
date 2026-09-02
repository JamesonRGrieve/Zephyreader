// @vitest-environment node
// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /api/v1/google/docs/list', () => {
  it('returns 401 (not 500) when the request has no authorization header', async () => {
    const res = await GET(new NextRequest('http://localhost/api/v1/google/docs/list'));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Missing authorization header.' });
  });
});
