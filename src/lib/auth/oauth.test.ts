// @vitest-environment node
// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FakeIdp, type IdpClaims } from '~/__tests__/fakeIdp';
import { ApiError } from '~/lib/apiErrors';
import { decryptSecret } from '~/lib/auth/crypto';
import { OAuthLogin } from '~/lib/auth/oauth';
import { authenticate } from '~/lib/auth/session';
import { prisma } from '~/lib/prisma';

const REDIRECT_URI = 'http://localhost/user/close/fake';
const VERIFIED: IdpClaims = { sub: 'idp-user-1', email: 'ada@example.com', email_verified: true, given_name: 'Ada' };

let idp: FakeIdp;
let signupAllowed = true;
let login: OAuthLogin;

beforeAll(async () => {
  idp = await FakeIdp.start();
  login = new OAuthLogin(
    { fake: () => idp.provider() },
    () => [REDIRECT_URI],
    () => signupAllowed,
  );
});
afterAll(() => idp.close());
beforeEach(async () => {
  signupAllowed = true;
  await prisma.user.deleteMany();
  await prisma.oAuthState.deleteMany();
});

/** Runs a full browser round-trip: authorize, IdP approval, callback. */
async function signInWith(claims: IdpClaims, tamper: { binding?: string; nonce?: string } = {}) {
  const begun = await login.beginAuthorize('fake');
  const code = idp.approve(begun.authorizeUrl, claims, { nonce: tamper.nonce });
  return {
    begun,
    code,
    complete: () =>
      login.completeCallback({
        provider: 'fake',
        code,
        state: begun.state,
        binding: 'binding' in tamper ? tamper.binding : begun.binding,
      }),
  };
}

async function expectApiError(promise: Promise<unknown>, status: number, detail?: string | RegExp) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).status).toBe(status);
  if (detail !== undefined) expect((error as ApiError).detail).toMatch(detail);
}

describe('OAuthLogin.beginAuthorize', () => {
  it('builds an authorization-code request with PKCE S256, state and nonce', async () => {
    const { authorizeUrl, state } = await login.beginAuthorize('fake');
    const params = new URL(authorizeUrl).searchParams;
    expect(authorizeUrl.startsWith(`${FakeIdp.ISSUER}/authorize?`)).toBe(true);
    expect(params.get('response_type')).toBe('code');
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(params.get('nonce')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(params.get('state')).toBe(state);
    expect(params.get('redirect_uri')).toBe(REDIRECT_URI);
  });

  it('stores the state hashed, never the raw value', async () => {
    const { state } = await login.beginAuthorize('fake');
    const rows = await prisma.oAuthState.findMany();
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(state);
  });

  it('rejects a redirect_uri outside the exact-match allowlist', async () => {
    await expectApiError(login.beginAuthorize('fake', `${REDIRECT_URI}/evil`), 400, 'redirect_uri not in allowlist');
  });

  it('rejects an unknown provider', async () => {
    await expectApiError(login.beginAuthorize('nope'), 400, /Unknown OAuth provider/);
  });
});

describe('OAuthLogin.completeCallback', () => {
  it('provisions a user on first sign-in and returns a working session token', async () => {
    const session = await (await signInWith(VERIFIED)).complete();

    const user = await authenticate(
      new Request('http://localhost/api/v1/user', { headers: { authorization: `Bearer ${session.token}` } }),
    );
    expect(user.email).toBe('ada@example.com');
    expect(user.firstName).toBe('Ada');
    expect(session.userId).toBe(user.id);
    expect(session.grantType).toBe('oauth_consumer');
  });

  it('stores the IdP tokens encrypted', async () => {
    const { code, complete } = await signInWith(VERIFIED);
    await complete();
    const link = await prisma.oAuthLink.findFirstOrThrow();
    expect(link.accessToken).not.toContain(code);
    expect(decryptSecret(link.accessToken ?? '')).toBe(`access-${code}`);
    expect(decryptSecret(link.refreshToken ?? '')).toBe(`refresh-${code}`);
  });

  it('refuses to reuse a state (single-use)', async () => {
    const { begun, complete } = await signInWith(VERIFIED);
    await complete();
    const replayCode = idp.approve(begun.authorizeUrl, VERIFIED);
    await expectApiError(
      login.completeCallback({ provider: 'fake', code: replayCode, state: begun.state, binding: begun.binding }),
      400,
      'Invalid or expired OAuth state',
    );
  });

  it('refuses a callback from a different browser (binding mismatch or missing)', async () => {
    await expectApiError((await signInWith(VERIFIED, { binding: 'someone-else' })).complete(), 400);
    await expectApiError((await signInWith(VERIFIED, { binding: undefined })).complete(), 400);
  });

  it('refuses an ID token whose nonce does not match the request', async () => {
    await expectApiError((await signInWith(VERIFIED, { nonce: 'replayed' })).complete(), 400, 'ID token nonce mismatch');
  });

  it('does not provision a user whose email the IdP has not verified', async () => {
    await expectApiError((await signInWith({ ...VERIFIED, email_verified: false })).complete(), 400);
    expect(await prisma.user.count()).toBe(0);
  });

  it('refuses sign-up when disabled', async () => {
    signupAllowed = false;
    await expectApiError((await signInWith(VERIFIED)).complete(), 403, 'Sign-up is disabled');
  });

  it('links an existing account by verified email instead of duplicating it', async () => {
    const existing = await prisma.user.create({ data: { email: 'ada@example.com' } });
    const session = await (await signInWith(VERIFIED)).complete();
    expect(session.userId).toBe(existing.id);
    expect(await prisma.user.count()).toBe(1);
  });

  it('recognises a returning user by IdP subject even after an email change', async () => {
    const first = await (await signInWith(VERIFIED)).complete();
    const second = await (await signInWith({ ...VERIFIED, email: 'ada@new.example.com', email_verified: false })).complete();
    expect(second.userId).toBe(first.userId);
  });

  it('refuses a disabled account', async () => {
    const first = await (await signInWith(VERIFIED)).complete();
    await prisma.user.update({ where: { id: first.userId }, data: { active: false } });
    await expectApiError((await signInWith(VERIFIED)).complete(), 403, 'User account is disabled');
  });
});
