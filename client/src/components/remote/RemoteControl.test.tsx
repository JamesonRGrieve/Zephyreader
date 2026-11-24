// SPDX-License-Identifier: AGPL-3.0-or-later
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveChannelHandlers, LiveDevice } from '~/features/sync/liveChannel';
import RemoteControl from './RemoteControl';

/** The one live channel the remote opens: what it was opened with, what it sent, and whether it closed. */
const live = vi.hoisted(() => ({
  args: [] as unknown[],
  handlers: null as LiveChannelHandlers | null,
  send: vi.fn(),
  closed: false,
}));

vi.mock('~/features/sync/liveChannel', async (original) => ({
  ...(await original<typeof import('~/features/sync/liveChannel')>()),
  LiveChannel: class {
    constructor(...args: unknown[]) {
      live.args = args;
    }
    open(handlers: LiveChannelHandlers) {
      live.handlers = handlers;
    }
    send(type: string, data: unknown) {
      live.send(type, data);
      return Promise.resolve(true);
    }
    close() {
      live.closed = true;
    }
  },
}));

const DISPLAY: LiveDevice = { client_id: 'laptop', label: 'Laptop', main: true, connected: true };
const OTHER_REMOTE: LiveDevice = { client_id: 'phone-2', label: 'Remote · Phone 2', main: false, connected: true };
const STATE = {
  playing: true,
  mode: 'constant',
  speed: 150,
  progress: 0.25,
  elapsed: 65,
  secondsLeft: 120,
  title: 'Launch keynote',
};

const handlers = () => live.handlers as LiveChannelHandlers;
const remote = () => render(<RemoteControl scriptId='script-1' apiBase='/api' deviceId='phone-1' deviceLabel='Phone' />);

describe('RemoteControl', () => {
  beforeEach(() => {
    live.handlers = null;
    live.send.mockClear();
    live.closed = false;
  });

  it('joins the script’s channel as a remote, and leaves it when closed', () => {
    const { unmount } = remote();
    expect(live.args).toEqual(['/api', 'script-script-1', 'phone-1', 'Remote · Phone']);
    unmount();
    expect(live.closed).toBe(true);
  });

  it('keeps every button off until it is connected and a prompter is open, and says why', () => {
    remote();
    expect(screen.getByText('Connecting…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();

    act(() => handlers().onConnection?.(true));
    // Another remote is not a prompter.
    act(() => handlers().onDevices([OTHER_REMOTE]));
    expect(screen.getByText(/Open this script's prompter on your display/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next cue' })).toBeDisabled();

    act(() => handlers().onDevices([OTHER_REMOTE, DISPLAY]));
    expect(screen.getByText('Waiting for the prompter…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next cue' })).toBeEnabled();
  });

  it('shows the prompter’s state, ignores messages that aren’t state, and sends each command', async () => {
    remote();
    act(() => {
      handlers().onConnection?.(true);
      handlers().onDevices([DISPLAY]);
      handlers().onMessage({ type: 'state', sender: 'laptop', data: { ...STATE, playing: 'yes' } });
      handlers().onMessage({ type: 'command', sender: 'laptop', data: STATE });
    });
    expect(screen.getByText('Waiting for the prompter…')).toBeInTheDocument();

    act(() => handlers().onMessage({ type: 'state', sender: 'laptop', data: STATE }));
    expect(screen.getByText('Launch keynote')).toBeInTheDocument();
    expect(screen.getByText(/Scrolling · 1:05 · 2:00 left · 150 words a minute/)).toBeInTheDocument();

    for (const [name, action] of [
      ['Pause', 'playPause'],
      ['Slower', 'slower'],
      ['Faster', 'faster'],
      ['To the start', 'toStart'],
      ['Scroll back', 'scrollBack'],
      ['Scroll forward', 'scrollForward'],
      ['Previous cue', 'previousCue'],
      ['Next cue', 'nextCue'],
    ] as const) {
      await userEvent.click(screen.getByRole('button', { name }));
      expect(live.send).toHaveBeenLastCalledWith('command', { action });
    }
  });
});
