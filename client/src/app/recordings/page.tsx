'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
import { RequireFeature } from 'zephyrex';
import { LoadProblem } from 'zephyrex/ui/load-problem';
import { PageHeader } from 'zephyrex/ui/page-header';
import { SkeletonRows } from 'zephyrex/ui/skeleton';
import { AppPage } from '~/components/common/AppPage';
import RecordingsLibrary from '~/components/recordings/RecordingsLibrary';
import { PAID_FEATURES, useCapabilities } from '~/features/capabilities';
import { useRecordings } from '~/features/data/records';

export default function RecordingsPage() {
  const capabilities = useCapabilities();
  const unlocked = capabilities.plans && capabilities.unlocked(PAID_FEATURES.cloudRecordings);
  const recordings = useRecordings(unlocked);

  return (
    <AppPage title='Recordings'>
      <div className='mb-6'>
        <PageHeader title='Recordings' />
      </div>
      {!capabilities.loaded ? null : !capabilities.plans ? (
        <p className='text-muted-foreground'>
          Takes you record from the prompter download straight to your device here; there is no cloud library on this server.
        </p>
      ) : (
        <RequireFeature feature={PAID_FEATURES.cloudRecordings} title='Cloud recordings'>
          {recordings.error !== undefined ? (
            <LoadProblem what='your recordings' error={recordings.error} onRetry={() => recordings.mutate()} />
          ) : recordings.data === undefined ? (
            <SkeletonRows rows={3} label='Loading your recordings…' />
          ) : (
            <RecordingsLibrary
              recordings={recordings.data}
              capabilities={capabilities}
              onChanged={() => recordings.mutate()}
            />
          )}
        </RequireFeature>
      )}
    </AppPage>
  );
}
