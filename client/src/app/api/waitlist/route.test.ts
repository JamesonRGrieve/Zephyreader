// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGIN = 'http://127.0.0.1:48012';
const fetcher = vi.fn<typeof fetch>();

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${ORIGIN}/api/waitlist`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, 'x-forwarded-for': '203.0.113.7', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

/** A fresh route module each test, so its rate limits start empty. */
async function route() {
  vi.resetModules();
  return import('./route');
}

// Each test imports the route afresh (its rate limits start empty); the first import is slow on a busy runner.
describe('POST /api/waitlist', { timeout: 30_000 }, () => {
  beforeEach(() => {
    vi.stubEnv('APP_URI', ORIGIN);
    vi.stubEnv('WAITLIST_WEB_FORM', 'waitlist-zephyreader');
    fetcher.mockReset().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('passes a signup to the ERP and answers 204', async () => {
    const { POST } = await route();
    const answer = await POST(post({ email: 'ada@example.com', plan: 'pro' }));
    expect(answer.status).toBe(204);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('is not there on a server with no intake (lite)', async () => {
    vi.stubEnv('WAITLIST_WEB_FORM', '');
    const { POST } = await route();
    expect((await POST(post({ email: 'ada@example.com', plan: 'pro' }))).status).toBe(404);
  });

  it('takes signups only from this app’s own pages', async () => {
    const { POST } = await route();
    expect((await POST(post({ email: 'ada@example.com', plan: 'pro' }, { origin: 'https://evil.example' }))).status).toBe(
      403,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('refuses a bad entry with 422 and a body that is not JSON with 400, sending nothing', async () => {
    const { POST } = await route();
    expect((await POST(post({ email: 'nope', plan: 'pro' }))).status).toBe(422);
    expect((await POST(post('{'))).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('lets one visitor sign up a few times an hour, then answers 429', async () => {
    const { POST } = await route();
    const statuses = [];
    for (let i = 0; i < 6; i += 1) statuses.push((await POST(post({ email: `a${i}@example.com`, plan: 'pro' }))).status);
    expect(statuses).toEqual([204, 204, 204, 204, 204, 429]);
  });

  it('answers 502 when the ERP does not take the lead', async () => {
    fetcher.mockResolvedValue(new Response('', { status: 500 }));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { POST } = await route();
    expect((await POST(post({ email: 'ada@example.com', plan: 'pro' }))).status).toBe(502);
  });
});
