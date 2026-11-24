// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The paid-plan waitlist. Paid plans are not on sale yet: someone who wants one leaves their
 * email, and this app's server passes it to Zephyrex's CRM as a lead (POST /api/waitlist,
 * src/app/api/waitlist/route.ts). The browser only ever calls this app's own origin.
 */
import type { WaitlistEntry } from '~/lib/waitlistIntake';

export { CONSENT_WORDING, USE_MAX_LENGTH, type WaitlistEntry } from '~/lib/waitlistIntake';
export type WaitlistPlan = WaitlistEntry['plan'];

/** A plain-language reason the server gave, or a general one. */
export class WaitlistError extends Error {}

export async function joinWaitlist(entry: WaitlistEntry, fetcher: typeof fetch = fetch): Promise<void> {
  let response: Response;
  try {
    response = await fetcher('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
  } catch {
    throw new WaitlistError("We couldn't reach the server. Check your connection and try again.");
  }
  if (response.ok) return;
  if (response.status === 404) throw new WaitlistError("The waitlist isn't open on this server yet.");
  if (response.status === 429) throw new WaitlistError('Too many tries just now. Wait a minute and try again.');
  if (response.status === 422) throw new WaitlistError('Check the email address and try again.');
  throw new WaitlistError("We couldn't add you to the waitlist just now. Try again later.");
}
