// @vitest-environment node
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The waitlist route as mounted: Zephyreader's own gates (a server with a web form, this app's
 * own pages) in front of @zephyrex/marketing's route, whose checks and limits are tested there.
 * The ERP is a fake; any other request fails the test, so nothing reaches the real ERP.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGIN = 'http://127.0.0.1:48012';
const ACCEPT = 'https://erp.zephyrex.ca/api/method/frappe.website.doctype.web_form.web_form.accept';
const erp = vi.fn<typeof fetch>();

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${ORIGIN}/api/waitlist`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, 'x-forwarded-for': '203.0.113.7', ...headers },
    body: JSON.stringify(body),
  });

/** A fresh route module each test, so its rate limits start empty. */
async function route() {
  vi.resetModules();
  return import('./route');
}

const ENTRY = { email: 'zephyrex-site-test+unit@example.com', name: 'Ada Lovelace', consent: true };

describe('POST /api/waitlist', { timeout: 30_000 }, () => {
  // The first import of the route (the framework, Next's server) is slow on a busy runner; done
  // once here, with time of its own, it leaves each test's fresh import fast. A test's request
  // that outran its timeout would otherwise finish during the next test and be counted there.
  beforeAll(async () => {
    await import('./route');
  }, 120_000);

  beforeEach(() => {
    vi.stubEnv('APP_URI', ORIGIN);
    vi.stubEnv('WAITLIST_WEB_FORM', 'waitlist-zephyreader');
    vi.stubEnv('WAITLIST_ERP_URL', '');
    erp.mockReset().mockImplementation(async (url) => {
      if (String(url) !== ACCEPT) throw new Error(`unexpected request to ${String(url)}`);
      return Response.json({ message: {} });
    });
    vi.stubGlobal('fetch', erp);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('hands the signup to the ERP through waitlist-zephyreader, as a Zephyreader lead', async () => {
    const { POST } = await route();
    const answer = await POST(post(ENTRY));
    expect(answer.status).toBe(202);
    expect(erp).toHaveBeenCalledOnce();
    const form = new URLSearchParams(String(erp.mock.calls[0]?.[1]?.body));
    expect(form.get('web_form')).toBe('waitlist-zephyreader');
    expect(JSON.parse(form.get('data') ?? '')).toMatchObject({
      doctype: 'CRM Lead',
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: ENTRY.email,
      crm_business: 'Zephyrex',
      enquiry: 'Zephyreader waitlist: accounts and paid plans',
    });
  });

  it('says which offer the person waits for, and refuses one it does not offer', async () => {
    const { POST } = await route();
    expect((await POST(post({ ...ENTRY, interest: 'team' }))).status).toBe(202);
    const form = new URLSearchParams(String(erp.mock.calls[0]?.[1]?.body));
    expect(JSON.parse(form.get('data') ?? '').enquiry).toBe(
      'Zephyreader waitlist: Team plan, shared with colleagues (team)',
    );
    expect((await POST(post({ ...ENTRY, interest: 'gold' }))).status).toBe(422);
    expect(erp).toHaveBeenCalledOnce();
  });

  it('is not there on a server with no web form (lite)', async () => {
    vi.stubEnv('WAITLIST_WEB_FORM', '');
    const { POST } = await route();
    expect((await POST(post(ENTRY))).status).toBe(404);
    expect(erp).not.toHaveBeenCalled();
  });

  it('takes signups only from this app’s own pages', async () => {
    const { POST } = await route();
    expect((await POST(post(ENTRY, { origin: 'https://evil.example' }))).status).toBe(403);
    expect(erp).not.toHaveBeenCalled();
  });

  it('refuses an entry without consent, sending nothing', async () => {
    const { POST } = await route();
    expect((await POST(post({ email: ENTRY.email }))).status).toBe(422);
    expect(erp).not.toHaveBeenCalled();
  });

  it('keeps its per-visitor limit across requests', async () => {
    const { POST } = await route();
    const answers = [];
    for (let i = 0; i < 6; i += 1) answers.push((await POST(post(ENTRY))).status);
    expect(answers).toEqual([202, 202, 202, 202, 202, 429]);
  });
});
