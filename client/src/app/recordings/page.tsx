'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
import { RequireFeature } from 'zephyrex';
import { SidebarInset } from 'zephyrex/ui/sidebar';
import RecordingsLibrary from '~/components/recordings/RecordingsLibrary';
import { PAID_FEATURES, useCapabilities } from '~/features/capabilities';
import { useRecordings } from '~/features/data/records';

export default function RecordingsPage() {
  const capabilities = useCapabilities();
  const unlocked = capabilities.plans && capabilities.unlocked(PAID_FEATURES.cloudRecordings);
  const recordings = useRecordings(unlocked);

  return (
    <SidebarInset className='min-h-svh'>
      <div className='mx-auto w-full max-w-6xl px-4 py-8'>
        <h1 className='mb-6 text-3xl font-bold'>Recordings</h1>
        {!capabilities.loaded ? null : !capabilities.plans ? (
          <p className='text-muted-foreground'>
            Takes you record from the prompter download straight to your device here; there is no cloud library on this
            server.
          </p>
        ) : (
          <RequireFeature feature={PAID_FEATURES.cloudRecordings} title='Cloud recordings'>
            {recordings.error !== undefined ? (
              <p role='alert' className='text-destructive'>
                Your recordings couldn&apos;t be loaded: {recordings.error.message}
              </p>
            ) : recordings.data === undefined ? (
              <p className='text-muted-foreground'>Loading your recordings…</p>
            ) : (
              <RecordingsLibrary
                recordings={recordings.data}
                capabilities={capabilities}
                onChanged={() => recordings.mutate()}
              />
            )}
          </RequireFeature>
        )}
      </div>
    </SidebarInset>
  );
}
