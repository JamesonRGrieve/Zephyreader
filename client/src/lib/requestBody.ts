// SPDX-License-Identifier: AGPL-3.0-or-later
import { ApiError } from '~/lib/apiErrors';

/**
 * The largest body a request may carry: server-framework's cap (InboundSecurity
 * DEFAULT_MAX_BODY_BYTES), refused with the same 413 as soon as it is exceeded, so an
 * oversized body never sits in memory.
 */
export const MAX_BODY_BYTES = 10 * 1024 * 1024;
const TOO_LARGE = 'Request body exceeds maximum allowed size';

/** The rest of the stream, refused the moment it passes the cap. */
async function collect(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  chunks: Uint8Array[],
  size: number,
): Promise<Uint8Array[]> {
  // A client that hangs up mid-body is not a server fault: refused like any unreadable body.
  const { done, value } = await reader.read().catch(() => {
    throw new ApiError(400, 'The request body could not be read');
  });
  if (done) return chunks;
  if (size + value.byteLength > MAX_BODY_BYTES) {
    await reader.cancel();
    throw new ApiError(413, TOO_LARGE);
  }
  chunks.push(value);
  return collect(reader, chunks, size + value.byteLength);
}

/** The request body as text, within the cap (a declared length over it is refused unread). */
async function readCapped(request: Request): Promise<string> {
  const declared = Number(request.headers.get('content-length') ?? Number.NaN);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw new ApiError(413, TOO_LARGE);
  if (request.body === null) return '';
  const chunks = await collect(request.body.getReader(), [], 0);
  return Buffer.concat(chunks).toString('utf8');
}

/** What server-framework answers for a body that isn't JSON at all (FastAPI's `json_invalid`, made a 400). */
export const INVALID_JSON = 'Invalid JSON syntax in request body';

/** server-framework's 422 for a missing body: FastAPI's validation list, as a probe of the real server gave it. */
export function missingBody(): ApiError {
  return new ApiError(422, [
    { type: 'missing', loc: ['body'], msg: 'Field required', input: null, ctx: { error: 'Field required' } },
  ]);
}

/** server-framework's 422 for a body that is JSON but not an object. */
export function notAnObject(input: unknown): ApiError {
  return new ApiError(422, [{ type: 'dict_type', loc: ['body'], msg: 'Input should be a valid dictionary', input }]);
}

/**
 * Parses a JSON request body into an object, answering as server-framework does: 400 when the
 * body isn't JSON, 422 when it is missing or is JSON but not an object, 413 when too large.
 */
export async function readJsonObject(request: Request): Promise<object> {
  const text = await readCapped(request);
  if (text.trim() === '') throw missingBody();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError(400, INVALID_JSON);
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw notAnObject(body);
  return body;
}

export function requiredString(body: object, key: string): string {
  const value: unknown = Reflect.get(body, key);
  if (typeof value !== 'string' || value === '') throw new ApiError(422, `${key} is required`);
  return value;
}

export function optionalString(body: object, key: string): string | undefined {
  const value: unknown = Reflect.get(body, key);
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new ApiError(422, `${key} must be a string`);
  return value;
}
