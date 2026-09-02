// @vitest-environment node
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest';
import { AuthError, apiErrorResponse } from './apiErrors';

describe('AuthError', () => {
  it('is an Error carrying a 401 status and the given message', () => {
    const err = new AuthError('nope');
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(401);
    expect(err.message).toBe('nope');
    expect(err.name).toBe('AuthError');
  });
});

describe('apiErrorResponse', () => {
  it('returns 401 with the message for an AuthError', async () => {
    const res = apiErrorResponse(new AuthError('Missing authorization header.'));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Missing authorization header.' });
  });

  it('returns an opaque 500 for any other error without leaking internals', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = apiErrorResponse(new Error('connection to postgres://secret failed'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Internal server error' });
    expect(JSON.stringify(body)).not.toContain('secret');
    spy.mockRestore();
  });
});
