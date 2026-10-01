// SPDX-License-Identifier: AGPL-3.0-or-later
import { getCookie } from 'cookies-next/client';
import { useSyncExternalStore } from 'react';

/**
 * Same-origin API prefix. The browser session rides in the HttpOnly
 * `zx_session` cookie, which the browser only sends to this origin, so requests
 * are relative by construction (an absolute URL behind a proxy would silently
 * become cross-origin and drop the session).
 */
const API_BASE = '/api';
/** JS-readable half of the session (see src/lib/auth/sessionCookies.ts). */
const CSRF_COOKIE = 'zx_csrf';

export function apiUrl(path: `/v1/${string}`): string {
  return `${API_BASE}${path}`;
}

/** Whether this browser holds a session (the HttpOnly session cookie itself is unreadable). */
export function hasSession(): boolean {
  return Boolean(getCookie(CSRF_COOKIE));
}

const noSubscription = (): (() => void) => () => {};

/**
 * `hasSession()` for rendering. The server cannot read the browser's cookies, so
 * the server render (and the hydrating first client render) says "signed out";
 * the real answer follows right after hydration instead of mismatching it.
 */
export function useHasSession(): boolean {
  return useSyncExternalStore(noSubscription, hasSession, () => false);
}

/** `X-CSRF-Token` echoing `zx_csrf`: required on cookie-authenticated writes, harmless on reads. */
export function sessionHeaders(): Record<string, string> {
  const csrf = getCookie(CSRF_COOKIE);
  return csrf ? { 'X-CSRF-Token': csrf } : {};
}
