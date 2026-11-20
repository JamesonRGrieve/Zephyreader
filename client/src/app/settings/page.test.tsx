// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '~/features/prompter/settings';
import { capabilities } from '~/stories/fixtures';
import SettingsPage from './page';

const prompter = vi.hoisted(() => ({
  state: {} as {
    loaded: boolean;
    error: Error | undefined;
    retry: () => Promise<unknown>;
    save: (settings: unknown) => Promise<void>;
  },
}));

vi.mock('~/features/data/records', () => ({ usePrompterSettings: () => ({ settings: DEFAULT_SETTINGS, ...prompter.state }) }));
vi.mock('~/features/capabilities', async (original) => ({
  ...(await original<typeof import('~/features/capabilities')>()),
  useCapabilities: () => capabilities(),
}));
vi.mock('~/components/common/AppPage', () => ({ AppPage: ({ children }: { children: ReactNode }) => <main>{children}</main> }));

describe('SettingsPage', () => {
  beforeEach(() => {
    prompter.state = {
      loaded: true,
      error: undefined,
      retry: vi.fn(async () => undefined),
      save: vi.fn(async () => undefined),
    };
  });

  it('shows a skeleton while the settings load', () => {
    prompter.state.loaded = false;
    render(<SettingsPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading your settings…');
  });

  it('says the settings could not be loaded, and loads them again on Try again', async () => {
    prompter.state.error = new Error('The server is busy');
    render(<SettingsPage />);
    expect(screen.getByText('Your settings could not be loaded.')).toBeInTheDocument();
    expect(screen.getByText('The server is busy')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(prompter.state.retry).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Save settings' })).toBeNull();
  });

  it('shows why a save failed beside the button', async () => {
    prompter.state.save = vi.fn(async () => Promise.reject(new Error('Someone else changed them')));
    render(<SettingsPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    // The framework's useWrites shows the server's reason beside the button.
    expect(await screen.findByText('Someone else changed them')).toHaveAttribute('role', 'alert');
  });
});
