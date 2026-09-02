// @vitest-environment node
// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it } from 'vitest';
import { AuthError } from '~/lib/apiErrors';
import verifyJWT from './AuthProvider';

function requestWith(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/v1/user', { headers });
}

const originalSecret = process.env.JWT_SECRET;
afterEach(() => {
  process.env.JWT_SECRET = originalSecret;
});

describe('verifyJWT', () => {
  it('throws AuthError (401-mapped) when the authorization header is missing', async () => {
    await expect(verifyJWT(requestWith())).rejects.toBeInstanceOf(AuthError);
  });

  it('throws a non-auth Error when JWT_SECRET is unset (server misconfig, 500-mapped)', async () => {
    delete process.env.JWT_SECRET;
    const err = await verifyJWT(requestWith({ authorization: 'Bearer anything' })).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(AuthError);
  });

  it('throws AuthError when the token is invalid', async () => {
    process.env.JWT_SECRET = 'test-secret';
    await expect(verifyJWT(requestWith({ authorization: 'Bearer not-a-real-jwt' }))).rejects.toBeInstanceOf(AuthError);
  });
});
