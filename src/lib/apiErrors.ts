// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse } from 'next/server';

/**
 * Thrown when a request cannot be authenticated (missing/invalid token, unknown
 * user). Route handlers translate it to a 401 rather than a generic 500.
 */
export class AuthError extends Error {
  readonly status = 401;

  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Maps a thrown value to an API error response: authentication failures become
 * 401 (surfacing their message), everything else is logged server-side and
 * returned as an opaque 500 so internal details never leak to the client.
 */
export function apiErrorResponse(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error('API route error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
