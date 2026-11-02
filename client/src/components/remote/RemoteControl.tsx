'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
import { ChevronFirst, ChevronsLeft, ChevronsRight, Minus, Pause, Play, Plus, Rewind, FastForward } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from 'zephyrex/ui/button';
import { Progress } from 'zephyrex/ui/progress';
import type { PrompterAction } from '~/features/control/actions';
import { clock } from '~/features/prompter/timing';
import { LiveChannel, REMOTE_LABEL_PREFIX, type LiveDevice } from '~/features/sync/liveChannel';
import { z } from 'zod';

const stateSchema = z.object({
  playing: z.boolean(),
  mode: z.string(),
  speed: z.number(),
  progress: z.number(),
  elapsed: z.number(),
  secondsLeft: z.number().nullable(),
  title: z.string(),
});
type RemoteState = z.infer<typeof stateSchema>;

export interface RemoteControlProps {
  scriptId: string;
  apiBase: string;
  deviceId: string;
  deviceLabel: string;
}

function Big({
  label,
  onPress,
  children,
  wide,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Button
      variant='outline'
      onClick={onPress}
      aria-label={label}
      className={`h-20 text-lg ${wide === true ? 'col-span-3' : ''}`}
    >
      {children}
    </Button>
  );
}

/** A phone (or any second screen) driving the prompter on this user's display. */
export default function RemoteControl({ scriptId, apiBase, deviceId, deviceLabel }: RemoteControlProps) {
  const channel = useRef<LiveChannel | null>(null);
  const [state, setState] = useState<RemoteState | null>(null);
  const [devices, setDevices] = useState<LiveDevice[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const live = new LiveChannel(apiBase, `script-${scriptId}`, deviceId, `${REMOTE_LABEL_PREFIX}${deviceLabel}`);
    live.open({
      onDevices: setDevices,
      onConnection: setConnected,
      onMessage: (message) => {
        if (message.type !== 'state') return;
        const parsed = stateSchema.safeParse(message.data);
        if (parsed.success) setState(parsed.data);
      },
    });
    channel.current = live;
    return () => live.close();
  }, [apiBase, scriptId, deviceId, deviceLabel]);

  const send = (action: PrompterAction) => void channel.current?.send('command', { action });
  const displays = devices.filter((device) => !(device.label ?? '').startsWith(REMOTE_LABEL_PREFIX));

  return (
    <div className='mx-auto flex w-full max-w-md flex-col gap-4'>
      <div className='rounded-lg border p-4' aria-live='polite'>
        {!connected ? (
          <p className='text-muted-foreground'>Connecting…</p>
        ) : displays.length === 0 ? (
          <p className='text-muted-foreground'>Open this script&apos;s prompter on your display, and it will appear here.</p>
        ) : state === null ? (
          <p className='text-muted-foreground'>Waiting for the prompter…</p>
        ) : (
          <div className='flex flex-col gap-2'>
            <p className='truncate font-medium'>{state.title}</p>
            <Progress value={state.progress * 100} aria-label='Progress through the script' />
            <p className='text-muted-foreground text-sm tabular-nums'>
              {state.playing ? 'Scrolling' : 'Paused'} · {clock(state.elapsed)}
              {state.secondsLeft !== null && ` · ${clock(state.secondsLeft)} left`}
              {state.mode === 'constant' && ` · speed ${state.speed}`}
            </p>
          </div>
        )}
      </div>
      <div className='grid grid-cols-3 gap-3'>
        <Big label={state?.playing === true ? 'Pause' : 'Start'} onPress={() => send('playPause')} wide>
          {state?.playing === true ? (
            <Pause className='mr-2 h-6 w-6' aria-hidden />
          ) : (
            <Play className='mr-2 h-6 w-6' aria-hidden />
          )}
          {state?.playing === true ? 'Pause' : 'Start'}
        </Big>
        <Big label='Slower' onPress={() => send('slower')}>
          <Minus className='h-6 w-6' aria-hidden />
        </Big>
        <Big label='Back to the start' onPress={() => send('toStart')}>
          <ChevronFirst className='h-6 w-6' aria-hidden />
        </Big>
        <Big label='Faster' onPress={() => send('faster')}>
          <Plus className='h-6 w-6' aria-hidden />
        </Big>
        <Big label='Scroll back' onPress={() => send('scrollBack')}>
          <Rewind className='h-6 w-6' aria-hidden />
        </Big>
        <Big label='Previous cue' onPress={() => send('previousCue')}>
          <ChevronsLeft className='h-6 w-6' aria-hidden />
        </Big>
        <Big label='Scroll forward' onPress={() => send('scrollForward')}>
          <FastForward className='h-6 w-6' aria-hidden />
        </Big>
        <Big label='Next cue' onPress={() => send('nextCue')} wide>
          <ChevronsRight className='mr-2 h-6 w-6' aria-hidden /> Next cue
        </Big>
      </div>
    </div>
  );
}
