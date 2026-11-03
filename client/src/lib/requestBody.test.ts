// @vitest-environment node
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { ApiError } from '~/lib/apiErrors';
import { MAX_BODY_BYTES, readJsonObject } from './requestBody';

const TOO_LARGE = 'Request body exceeds maximum allowed size';

/** A POST whose body arrives as a stream of `chunks` (no declared length unless given). */
function streamed(chunks: Uint8Array[], contentLength?: number): Request {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return new Request('http://localhost/api/v1/script', {
    method: 'POST',
    body,
    duplex: 'half',
    headers: contentLength === undefined ? {} : { 'content-length': String(contentLength) },
  } as RequestInit);
}

async function refusal(promise: Promise<unknown>): Promise<ApiError> {
  const error: unknown = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

describe('readJsonObject', () => {
  it('reads a JSON object', async () => {
    await expect(readJsonObject(new Request('http://localhost', { method: 'POST', body: '{"a":1}' }))).resolves.toEqual({
      a: 1,
    });
  });

  it('refuses anything but a JSON object with 422', async () => {
    for (const body of ['[1]', 'null', 'not json', '']) {
      const error = await refusal(readJsonObject(new Request('http://localhost', { method: 'POST', body })));
      expect(error.status).toBe(422);
    }
  });

  it('refuses a body declared over the framework cap with 413, before reading it', async () => {
    const error = await refusal(readJsonObject(streamed([new Uint8Array(1)], MAX_BODY_BYTES + 1)));
    expect(error.status).toBe(413);
    expect(error.message).toBe(TOO_LARGE);
  });

  it('answers a body the client abandons with 400, not a server error', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([0x7b]));
        controller.error(new Error('aborted'));
      },
    });
    const abandoned = new Request('http://localhost/api/v1/script', { method: 'POST', body, duplex: 'half' } as RequestInit);
    const error = await refusal(readJsonObject(abandoned));
    expect(error.status).toBe(400);
  });

  it('refuses a body that streams past the cap with no declared length', async () => {
    const chunk = new Uint8Array(1024 * 1024).fill(0x20);
    const chunks = Array.from({ length: MAX_BODY_BYTES / chunk.byteLength + 1 }, () => chunk);
    const error = await refusal(readJsonObject(streamed(chunks)));
    expect(error.status).toBe(413);
  });
});
