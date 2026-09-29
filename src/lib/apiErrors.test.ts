// @vitest-environment node
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest';
import { ApiError, apiErrorResponse } from './apiErrors';

describe('apiErrorResponse', () => {
  it('returns an ApiError as { detail } with its status', async () => {
    const res = apiErrorResponse(new ApiError(401, 'No authentication provided.'));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ detail: 'No authentication provided.' });
  });

  it('returns the opaque server-framework 500 body for any other error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = apiErrorResponse(new Error('connection to postgres://secret failed'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ detail: { message: 'Internal Server Error', code: 'internal_error' } });
    expect(JSON.stringify(body)).not.toContain('secret');
    spy.mockRestore();
  });
});
