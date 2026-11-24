// SPDX-License-Identifier: AGPL-3.0-or-later
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Capabilities } from '~/features/capabilities';
import { DEFAULT_SETTINGS, type PrompterSettings } from '~/features/prompter/settings';
import type { LiveChannelHandlers } from '~/features/sync/liveChannel';
import { capabilities, KEYNOTE } from '~/stories/fixtures';
import PrompterView from './PrompterView';

/** The live channel the prompter opens, when screens can sync. */
const live = vi.hoisted(() => ({ handlers: null as LiveChannelHandlers | null, send: vi.fn(), claim: vi.fn() }));
vi.mock('~/features/sync/liveChannel', async (original) => ({
  ...(await original<typeof import('~/features/sync/liveChannel')>()),
  LiveChannel: class {
    open(handlers: LiveChannelHandlers) {
      live.handlers = handlers;
    }
    send(type: string, data: unknown) {
      live.send(type, data);
      return Promise.resolve(true);
    }
    claim() {
      live.claim();
      return Promise.resolve(true);
    }
    close() {}
  },
}));

const SETTINGS: PrompterSettings = { ...DEFAULT_SETTINGS, countdownSeconds: 0, scrollMode: 'manual' };

function prompter(can: Capabilities = capabilities({ liveSync: false })) {
  const onSettingsChange = vi.fn();
  render(
    <PrompterView
      script={KEYNOTE}
      settings={SETTINGS}
      savedSettings={SETTINGS}
      onSettingsChange={onSettingsChange}
      onSaveDefaults={vi.fn().mockResolvedValue(undefined)}
      capabilities={can}
      apiBase='/api'
      deviceId='laptop'
      deviceLabel='Laptop'
      upload={vi.fn().mockResolvedValue(undefined)}
    />,
  );
  return { onSettingsChange };
}

describe('PrompterView', () => {
  beforeEach(() => {
    // jsdom has no Gamepad API; the prompter reads it for game controllers.
    Object.defineProperty(navigator, 'getGamepads', { value: () => [], configurable: true });
    live.handlers = null;
    live.send.mockClear();
  });

  it('shows the script and starts and pauses from the toolbar and the space bar', async () => {
    prompter();
    expect(screen.getByRole('region', { name: 'Script' })).toHaveTextContent('Good evening');
    expect(screen.getByRole('link', { name: 'Back to the editor' })).toHaveAttribute('href', `/script/${KEYNOTE.id}`);
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: ' ' });
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
  });

  it('mirrors the script from the keyboard, as a setting change', () => {
    const { onSettingsChange } = prompter();
    fireEvent.keyDown(window, { key: 'm' });
    expect(onSettingsChange).toHaveBeenCalledWith({ ...SETTINGS, mirrorHorizontal: true });
  });

  it('opens each panel with its heading and what it is for, and keys stay out of the script while one is open', async () => {
    const { onSettingsChange } = prompter();
    await userEvent.click(screen.getByRole('button', { name: 'Record' }));
    const dialog = await screen.findByRole('dialog', { name: 'Record a take' });
    expect(dialog).toHaveTextContent('The script stays on your screen; it is never in the video.');
    fireEvent.keyDown(window, { key: 'm' });
    expect(onSettingsChange).not.toHaveBeenCalled();
  });

  it('offers the devices panel only where screens can sync', () => {
    prompter();
    expect(screen.queryByRole('button', { name: 'Devices and remote' })).not.toBeInTheDocument();
  });

  it('on a display that follows, asks the leader to act instead of scrolling itself', async () => {
    prompter(capabilities({ liveSync: true }));
    act(() =>
      live.handlers?.onDevices([
        { client_id: 'desk', label: 'Desk', main: true, connected: true },
        { client_id: 'laptop', label: 'Laptop', main: false, connected: true },
      ]),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(live.send).toHaveBeenCalledWith('command', { action: 'playPause' });
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
  });

  it('does what a remote asks of the leading display', () => {
    prompter(capabilities({ liveSync: true }));
    act(() => live.handlers?.onDevices([{ client_id: 'laptop', label: 'Laptop', main: true, connected: true }]));
    act(() => live.handlers?.onMessage({ type: 'command', sender: 'phone', data: { action: 'playPause' } }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });
});
