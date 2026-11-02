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

/** A big button: its icon, and what it does in words beneath (an icon alone is guesswork on a phone in a hurry). */
function Big({
  label,
  icon,
  onPress,
  disabled,
  wide,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  disabled: boolean;
  wide?: boolean;
}) {
  return (
    <Button
      variant='outline'
      onClick={onPress}
      disabled={disabled}
      className={`h-20 ${wide === true ? 'col-span-3 gap-2 text-lg' : 'flex-col gap-1 text-xs'}`}
    >
      {icon}
      <span>{label}</span>
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
  // Nothing to drive until a prompter is open: the buttons say so by being off.
  const idle = !connected || displays.length === 0;

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
              {state.mode === 'constant' && ` · ${state.speed} words a minute`}
            </p>
          </div>
        )}
      </div>
      <div className='grid grid-cols-3 gap-3'>
        <Big
          label={state?.playing === true ? 'Pause' : 'Start'}
          icon={
            state?.playing === true ? <Pause className='h-6 w-6' aria-hidden /> : <Play className='h-6 w-6' aria-hidden />
          }
          onPress={() => send('playPause')}
          disabled={idle}
          wide
        />
        <Big
          label='Slower'
          icon={<Minus className='h-6 w-6' aria-hidden />}
          onPress={() => send('slower')}
          disabled={idle}
        />
        <Big
          label='To the start'
          icon={<ChevronFirst className='h-6 w-6' aria-hidden />}
          onPress={() => send('toStart')}
          disabled={idle}
        />
        <Big label='Faster' icon={<Plus className='h-6 w-6' aria-hidden />} onPress={() => send('faster')} disabled={idle} />
        <Big
          label='Scroll back'
          icon={<Rewind className='h-6 w-6' aria-hidden />}
          onPress={() => send('scrollBack')}
          disabled={idle}
        />
        <Big
          label='Previous cue'
          icon={<ChevronsLeft className='h-6 w-6' aria-hidden />}
          onPress={() => send('previousCue')}
          disabled={idle}
        />
        <Big
          label='Scroll forward'
          icon={<FastForward className='h-6 w-6' aria-hidden />}
          onPress={() => send('scrollForward')}
          disabled={idle}
        />
        <Big
          label='Next cue'
          icon={<ChevronsRight className='h-6 w-6' aria-hidden />}
          onPress={() => send('nextCue')}
          disabled={idle}
          wide
        />
      </div>
    </div>
  );
}
