'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
import { AppPage } from '~/components/common/AppPage';
import LibraryPage from '~/components/library/LibraryPage';

export default function ScriptsPage() {
  return (
    <AppPage title='Your scripts'>
      <h1 className='mb-6 text-3xl font-bold'>Your scripts</h1>
      <LibraryPage />
    </AppPage>
  );
}
