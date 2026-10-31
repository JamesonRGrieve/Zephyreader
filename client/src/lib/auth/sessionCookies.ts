// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Browser sessions carried in cookies, mirroring server-framework's
 * lib/SessionCookies.py: a login sets `zx_session` (the session JWT, HttpOnly)
 * and `zx_csrf` (a random token page scripts can read). A cookie-authenticated
 * request that can change state must echo `zx_csrf` in `X-CSRF-Token`
 * (double submit) or it is refused with 403.
 */
import { randomBytes } from 'node:crypto';
import type { NextResponse } from 'next/server';

export const SESSION_COOKIE = 'zx_session';
export const CSRF_COOKIE = 'zx_csrf';
export const CSRF_HEADER = 'x-csrf-token';
export const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);
/** Login tokens, and the session cookie that carries them, live this long (= JWT exp). */
export const SESSION_COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60;
const CSRF_TOKEN_BYTES = 32;

function cookieAttributes(httpOnly: boolean) {
  return {
    path: '/',
    // Unset means host-only, which a same-origin deployment wants.
    domain: process.env.SESSION_COOKIE_DOMAIN || undefined,
    secure: true,
    httpOnly,
    sameSite: 'lax' as const,
  };
}

/** Hands the browser a session: the JWT, and a fresh CSRF token to echo. */
export function setSessionCookies(response: NextResponse, token: string): void {
  const maxAge = SESSION_COOKIE_MAX_AGE_SECONDS;
  response.cookies.set(SESSION_COOKIE, token, { ...cookieAttributes(true), maxAge });
  response.cookies.set(CSRF_COOKIE, randomBytes(CSRF_TOKEN_BYTES).toString('base64url'), {
    ...cookieAttributes(false),
    maxAge,
  });
}

export function clearSessionCookies(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, '', { ...cookieAttributes(true), maxAge: 0 });
  response.cookies.set(CSRF_COOKIE, '', { ...cookieAttributes(false), maxAge: 0 });
}

/** Parses a `Cookie` request header into name → value. */
export function parseCookies(header: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const pair of (header ?? '').split(';')) {
    const separator = pair.indexOf('=');
    if (separator > 0) cookies.set(pair.slice(0, separator).trim(), decodeURIComponent(pair.slice(separator + 1).trim()));
  }
  return cookies;
}
