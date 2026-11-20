'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
import { PageHeader } from 'zephyrex/ui/page-header';
import { AppPage } from '~/components/common/AppPage';
import LibraryPage from '~/components/library/LibraryPage';

export default function ScriptsPage() {
  return (
    <AppPage title='Your scripts'>
      <div className='mb-6'>
        <PageHeader title='Your scripts' />
      </div>
      <LibraryPage />
    </AppPage>
  );
}
