// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse } from 'next/server';

/**
 * An error whose status and `detail` are safe to show the client. Mirrors the
 * server-framework error body: `{ "detail": "<message>" }`.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(detail);
    this.name = 'ApiError';
  }
}

const INTERNAL_ERROR_BODY = { detail: { message: 'Internal Server Error', code: 'internal_error' } };

/**
 * Maps a thrown value to an API error response. An ApiError surfaces its status
 * and detail; anything else is logged server-side and returned as the opaque
 * server-framework 500 body so internal details never leak.
 */
export function apiErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ detail: error.detail }, { status: error.status });
  }
  console.error('API route error:', error);
  return NextResponse.json(INTERNAL_ERROR_BODY, { status: 500 });
}
