// SPDX-License-Identifier: AGPL-3.0-or-later
import { redirect } from 'next/navigation';
import { PLANS_PATH } from '~/zephyrex.config';

/**
 * Where the framework sends someone to subscribe (the session check's 402, and "See plans" by
 * default). Paid plans are waitlist-only, so it is the plans page.
 */
export default function SubscribePage(): never {
  redirect(PLANS_PATH);
}
