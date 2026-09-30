// SPDX-License-Identifier: AGPL-3.0-or-later
import { getCookie } from 'cookies-next/client';

/** API origin + `/api`; paths are server-framework style (`/v1/...`), as the framework client builds them. */
const API_BASE = process.env.NEXT_PUBLIC_API_URI ?? '/api';

export function apiUrl(path: `/v1/${string}`): string {
  return `${API_BASE}${path}`;
}

/** `Authorization: Bearer <jwt>` for the signed-in user, or no header when signed out. */
export function authHeaders(): Record<string, string> {
  const jwt = getCookie('jwt');
  return jwt ? { Authorization: `Bearer ${jwt}` } : {};
}
