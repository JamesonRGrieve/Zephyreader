'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
import { PageHeader } from 'zephyrex/ui/page-header';
import { AppPage } from '~/components/common/AppPage';
import WaitlistForm from '~/components/plans/WaitlistForm';

const PAID = [
  'The AI writer: draft, shorten and rework a script',
  'Captions for your recordings',
  'Cloud recordings, kept with your scripts',
  'Server voice-follow, the most accurate',
  'Sharing scripts with a team (Team plan)',
];

/**
 * Plans, where every "See plans" and the subscribe redirect lead. Paid plans are not on sale:
 * the page says so and takes a place on the waitlist instead of a payment. A server with no
 * waitlist (lite) has no paid plans to wait for.
 */
export default function PlansView({ waitlist }: { waitlist: boolean }) {
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
              Paid plans: waitlist only
            </h2>
            <p>
              {
                "Paid plans aren't on sale yet, and nothing here takes a payment. Join the waitlist and we'll email you when they open. Everything in the free plan stays free."
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
          <section aria-labelledby='plans-join' className='grid gap-4 rounded-lg border p-5'>
            <h2 id='plans-join' className='text-lg font-semibold'>
              Join the waitlist
            </h2>
            <WaitlistForm />
          </section>
        </div>
      )}
    </AppPage>
  );
}
