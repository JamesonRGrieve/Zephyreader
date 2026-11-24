// SPDX-License-Identifier: AGPL-3.0-or-later
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import PlansView from '~/components/plans/PlansView';
import { intakeConfig } from '~/lib/waitlistIntake';

/**
 * Plans. Whether there is a waitlist is this server's own setting (WAITLIST_WEB_FORM), read per
 * request, so the page is the same signed in or out: a visitor from the landing page sees it too.
 */
export default async function PlansPage(): Promise<ReactNode> {
  await connection();
  return <PlansView waitlist={intakeConfig() !== undefined} />;
}
