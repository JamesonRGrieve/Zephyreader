// SPDX-License-Identifier: AGPL-3.0-or-later
import { cookies } from 'next/headers';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import PlansView from '~/components/plans/PlansView';
import { CSRF_COOKIE } from '~/lib/auth/sessionCookies';
import { waitlistSettings } from '~/lib/waitlist';

/**
 * Plans, and the waitlist. Whether there is a waitlist is this server's own setting
 * (WAITLIST_WEB_FORM), read per request, so the page is the same signed in or out: the landing
 * page and the closed sign-up page (SIGNUP_DISABLED_PATH) lead a visitor here too. A visitor's
 * form starts on an account; someone signed in (the session cookie a sign-in leaves) on Pro.
 */
export default async function PlansPage(): Promise<ReactNode> {
  await connection();
  const signedIn = (await cookies()).has(CSRF_COOKIE);
  return <PlansView waitlist={waitlistSettings() !== undefined} initialInterest={signedIn ? 'pro' : 'account'} />;
}
