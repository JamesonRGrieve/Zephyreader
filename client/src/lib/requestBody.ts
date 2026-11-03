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

/** Parses a JSON request body into an object, or fails with the server-framework 422 (413 when too large). */
export async function readJsonObject(request: Request): Promise<object> {
  const text = await readCapped(request);
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ApiError(422, 'Request body must be a JSON object');
  }
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
