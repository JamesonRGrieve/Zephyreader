// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse } from 'next/server';

/**
 * An error's `detail`, in the shapes server-framework answers with: a plain string
 * (authentication, `428 If-Match required`, malformed JSON), its envelope
 * `{ message, code?, errors? }` (records not found, conflicts, validation), FastAPI's list of
 * validation errors (a missing body, a body that isn't an object), and the structured 402 bodies.
 */
export type ErrorDetail =
  | string
  | { message: string; code?: string; errors?: unknown[] }
  | Record<string, unknown>
  | Record<string, unknown>[];

/** An error whose status and `detail` are safe to show the client. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: ErrorDetail,
  ) {
    super(typeof detail === 'string' ? detail : JSON.stringify(detail));
    this.name = 'ApiError';
  }
}

/** A record-level refusal (404, 409, 403), in the framework's envelope. */
export function recordError(status: number, message: string): ApiError {
  return new ApiError(status, { message });
}

/** A request the framework's validation refuses: 422 with its envelope. */
export function validationError(message: string, field?: string): ApiError {
  return new ApiError(422, {
    message: 'Validation error',
    code: 'validation_error',
    errors: [{ loc: field === undefined ? [] : [field], msg: message }],
  });
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
