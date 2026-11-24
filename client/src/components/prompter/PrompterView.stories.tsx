// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, fn, userEvent, within } from 'storybook/test';
import { DEFAULT_SETTINGS } from '~/features/prompter/settings';
import { capabilities, KEYNOTE } from '~/stories/fixtures';
import PrompterView from './PrompterView';

const SETTINGS = { ...DEFAULT_SETTINGS, countdownSeconds: 0, scrollMode: 'manual' as const };

const meta: Meta<typeof PrompterView> = {
  title: 'Prompter/Prompter',
  component: PrompterView,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div style={{ height: '100vh' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    script: KEYNOTE,
    settings: SETTINGS,
    savedSettings: SETTINGS,
    onSettingsChange: fn(),
    onSaveDefaults: fn(async () => undefined),
    // No live channel in Storybook: one screen, no devices panel.
    capabilities: capabilities({ liveSync: false }),
    apiBase: '/api',
    deviceId: 'story-laptop',
    deviceLabel: 'Laptop',
    upload: fn(async () => undefined),
  },
};
export default meta;
type Story = StoryObj<typeof PrompterView>;

/** The script on the prompter, ready to start, with its toolbar. */
export const Ready: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('region', { name: 'Script' })).toHaveTextContent('Good evening');
    await expect(canvas.getByRole('button', { name: 'Start' })).toBeVisible();
  },
};

/** Mirrored for a beam-splitter rig. */
export const Mirrored: Story = { args: { settings: { ...SETTINGS, mirrorHorizontal: true } } };

/** Started from the toolbar: the button turns to Pause. */
export const Playing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Start' }));
    await expect(canvas.getByRole('button', { name: 'Pause' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Pause' }));
  },
};
