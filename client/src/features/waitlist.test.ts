// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest';
import { joinWaitlist, WaitlistError } from './waitlist';

const ENTRY = { email: 'ada@example.com', plan: 'pro' as const };
const answering = (status: number) => vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status }));

describe('joinWaitlist', () => {
  it('posts the entry to this app’s own back end, never a third party', async () => {
    const fetcher = answering(204);
    await joinWaitlist(ENTRY, fetcher);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('/api/waitlist');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual(ENTRY);
  });

  it.each([
    [422, 'Check the email address and try again.'],
    [429, 'Too many tries just now. Wait a minute and try again.'],
    [502, "We couldn't add you to the waitlist just now. Try again later."],
  ])('says in plain words why a %i failed', async (status, message) => {
    await expect(joinWaitlist(ENTRY, answering(status))).rejects.toEqual(new WaitlistError(message));
  });

  it('says when the server cannot be reached', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(joinWaitlist(ENTRY, fetcher)).rejects.toThrow("We couldn't reach the server.");
  });
});
