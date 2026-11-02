'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AppPage } from '~/components/common/AppPage';
import RemoteControl from '~/components/remote/RemoteControl';
import { useCapabilities } from '~/features/capabilities';
import { useScripts } from '~/features/data/records';
import { useThisDevice } from '~/features/sync/thisDevice';
import appConfig from '~/zephyrex.config';

function Remote() {
  const scriptId = useSearchParams().get('script');
  const capabilities = useCapabilities();
  const scripts = useScripts();
  const device = useThisDevice();

  if (capabilities.loaded && !capabilities.liveSync) {
    return <p className='text-muted-foreground'>Remote control isn&apos;t available here.</p>;
  }
  if (scriptId === null) {
    return (
      <div className='flex flex-col gap-3'>
        <p className='text-muted-foreground'>Which script are you presenting?</p>
        <ul className='divide-border divide-y rounded-lg border'>
          {(scripts.data ?? []).map((script) => (
            <li key={script.id}>
              <Link href={`/remote?script=${script.id}`} className='block px-4 py-3 hover:bg-muted'>
                {script.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (device === null) return null;
  return (
    <RemoteControl scriptId={scriptId} apiBase={appConfig.server.baseUrl} deviceId={device.id} deviceLabel={device.label} />
  );
}

export default function RemotePage() {
  return (
    <AppPage title='Remote control' width='narrow'>
      <h1 className='mb-4 text-2xl font-bold'>Remote control</h1>
      <Suspense>
        <Remote />
      </Suspense>
    </AppPage>
  );
}
