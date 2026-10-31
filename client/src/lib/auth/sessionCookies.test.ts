// @vitest-environment node
// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse } from 'next/server';
import { afterEach, describe, expect, it } from 'vitest';
import { clearSessionCookies, parseCookies, setSessionCookies } from './sessionCookies';

afterEach(() => {
  delete process.env.SESSION_COOKIE_DOMAIN;
});

describe('setSessionCookies', () => {
  it('sets zx_session (HttpOnly) and zx_csrf (JS-readable) with the server-framework attributes', () => {
    const response = new NextResponse(null);
    setSessionCookies(response, 'the-jwt');
    const session = response.cookies.get('zx_session');
    const csrf = response.cookies.get('zx_csrf');

    expect(session).toMatchObject({
      value: 'the-jwt',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 86400,
    });
    expect(csrf).toMatchObject({ httpOnly: false, secure: true, sameSite: 'lax', path: '/', maxAge: 86400 });
    expect(csrf?.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // Host-only unless SESSION_COOKIE_DOMAIN is set.
    expect(session?.domain).toBeUndefined();
  });

  it('issues a fresh CSRF token per login', () => {
    const first = new NextResponse(null);
    const second = new NextResponse(null);
    setSessionCookies(first, 'jwt');
    setSessionCookies(second, 'jwt');
    expect(first.cookies.get('zx_csrf')?.value).not.toBe(second.cookies.get('zx_csrf')?.value);
  });

  it('scopes both cookies to SESSION_COOKIE_DOMAIN when configured', () => {
    process.env.SESSION_COOKIE_DOMAIN = 'example.com';
    const response = new NextResponse(null);
    setSessionCookies(response, 'jwt');
    expect(response.cookies.get('zx_session')?.domain).toBe('example.com');
    expect(response.cookies.get('zx_csrf')?.domain).toBe('example.com');
  });
});

describe('clearSessionCookies', () => {
  it('expires both cookies', () => {
    const response = new NextResponse(null);
    clearSessionCookies(response);
    expect(response.cookies.get('zx_session')).toMatchObject({ value: '', maxAge: 0 });
    expect(response.cookies.get('zx_csrf')).toMatchObject({ value: '', maxAge: 0 });
  });
});

describe('parseCookies', () => {
  it('parses a Cookie header, trimming and decoding values', () => {
    expect(Object.fromEntries(parseCookies('a=1; zx_session=x%3Dy ;b='))).toEqual({ a: '1', zx_session: 'x=y', b: '' });
    expect(parseCookies(null).size).toBe(0);
  });
});
