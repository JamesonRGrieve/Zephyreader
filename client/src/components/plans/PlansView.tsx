'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
import { WaitlistForm } from '@zephyrex/marketing';
import { PageHeader } from 'zephyrex/ui/page-header';
import { AppPage } from '~/components/common/AppPage';
import { WAITLIST_INTERESTS, type WaitlistInterest } from '~/lib/waitlist';

const PAID = [
  'The AI writer: draft, shorten and rework a script',
  'Captions for your recordings',
  'Cloud recordings, kept with your scripts',
  'Server voice-follow, the most accurate',
  'Sharing scripts with a team (Team plan)',
];

/**
 * Plans, where every "See plans", the subscribe redirect, the landing page and the closed sign-up
 * page lead. New accounts and paid plans are waitlist only: the page says so and takes a place on
 * the waitlist (@zephyrex/marketing's WaitlistForm) instead of a sign-up or a payment. A server
 * with no waitlist (lite) has no paid plans to wait for.
 */
export default function PlansView({
  waitlist,
  initialInterest = 'account',
}: {
  waitlist: boolean;
  /** The offer chosen to start with: an account for a visitor, the Pro plan for someone signed in. */
  initialInterest?: WaitlistInterest;
}) {
  return (
    <AppPage title='Plans' width='medium'>
      <div className='mb-6'>
        <PageHeader title='Plans' />
      </div>
      {!waitlist ? (
        <p className='text-muted-foreground'>This server has no paid plans. Everything it offers is included.</p>
      ) : (
        <div className='grid gap-8'>
          <section aria-labelledby='plans-waitlist' className='grid gap-3'>
            <h2 id='plans-waitlist' className='text-xl font-semibold'>
              Accounts and paid plans: waitlist only
            </h2>
            <p>
              {
                "New accounts aren't open yet, and paid plans aren't on sale: nothing here takes a payment. Join the waitlist and we'll email you when they open. Everything in the free plan stays free."
              }
            </p>
          </section>
          <section aria-labelledby='plans-paid' className='grid gap-3'>
            <h2 id='plans-paid' className='text-lg font-semibold'>
              What paid plans will add
            </h2>
            <ul className='text-muted-foreground grid list-disc gap-1 pl-5'>
              {PAID.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <WaitlistForm
            title='Join the waitlist'
            body={<p>Leave your email, and your name if you like. We write once, when accounts and paid plans open.</p>}
            privacyHref='/docs/privacy'
            interests={WAITLIST_INTERESTS}
            initialInterest={initialInterest}
            interestLabel='What are you waiting for?'
          />
        </div>
      )}
    </AppPage>
  );
}
