// SPDX-License-Identifier: AGPL-3.0-or-later
import type { NextRequest, NextResponse } from 'next/server';

/** HttpOnly cookie binding an in-flight OAuth `state` to the browser that started it. */
export const OAUTH_BINDING_COOKIE = 'zx_oauth_binding';
const BINDING_COOKIE_PATH = '/api/v1/auth/oauth';
const BINDING_TTL_SECONDS = 10 * 60;

export function setBindingCookie(request: NextRequest, response: NextResponse, binding: string): void {
  response.cookies.set(OAUTH_BINDING_COOKIE, binding, {
    httpOnly: true,
    secure: request.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    path: BINDING_COOKIE_PATH,
    maxAge: BINDING_TTL_SECONDS,
  });
}

export function clearBindingCookie(response: NextResponse): void {
  response.cookies.set(OAUTH_BINDING_COOKIE, '', { httpOnly: true, path: BINDING_COOKIE_PATH, maxAge: 0 });
}
