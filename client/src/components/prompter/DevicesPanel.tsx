'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
import { Crown, MonitorSmartphone } from 'lucide-react';
import Link from 'next/link';
import { Button } from 'zephyrex/ui/button';
import type { LiveDevice } from '~/features/sync/liveChannel';

export interface DevicesPanelProps {
  devices: LiveDevice[];
  thisDevice: string;
  isMain: boolean;
  connected: boolean;
  remoteHref: string;
  onClaim: () => void;
}

/** This user's displays and remotes on the script: which one drives, and taking control. */
export default function DevicesPanel({ devices, thisDevice, isMain, connected, remoteHref, onClaim }: DevicesPanelProps) {
  return (
    <div className='flex flex-col gap-4'>
      {!connected && (
        <p role='status' className='text-destructive text-sm'>
          Reconnecting…
        </p>
      )}
      <ul className='divide-border divide-y rounded-md border'>
        {devices.map((device) => (
          <li key={device.client_id} className='flex items-center gap-3 px-3 py-2'>
            <MonitorSmartphone className='h-4 w-4 shrink-0' aria-hidden />
            <span className='min-w-0 flex-1 truncate text-sm'>{device.label ?? device.client_id}</span>
            {device.client_id === thisDevice && (
              <span className='text-muted-foreground shrink-0 rounded border px-1.5 text-xs'>This device</span>
            )}
            {device.main && <Crown className='text-primary h-4 w-4' aria-label='Leading' />}
          </li>
        ))}
      </ul>
      {!isMain && <Button onClick={onClaim}>Lead from this device</Button>}
      <Button asChild variant='outline'>
        <Link href={remoteHref} target='_blank' rel='noopener'>
          Open the remote control
        </Link>
      </Button>
    </div>
  );
}
