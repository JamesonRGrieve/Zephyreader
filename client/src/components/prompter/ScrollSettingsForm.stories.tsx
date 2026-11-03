// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, fn, userEvent, within } from 'storybook/test';
import { DEFAULT_SETTINGS } from '~/features/prompter/settings';
import ScrollSettingsForm from './ScrollSettingsForm';

const meta: Meta<typeof ScrollSettingsForm> = {
  title: 'Prompter/Scroll settings',
  component: ScrollSettingsForm,
  tags: ['autodocs'],
  args: {
    settings: DEFAULT_SETTINGS,
    onChange: fn(),
    engines: {
      local: { available: true, note: 'Your voice never leaves this device.' },
      browser: { available: true, note: 'In Chrome and Edge your voice is sent to the browser maker.' },
      server: { available: false, note: 'Included in paid plans.' },
    },
  },
};
export default meta;
type Story = StoryObj<typeof ScrollSettingsForm>;

/** A steady speed, in words a minute: the same pace on every screen. */
export const SteadySpeed: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('150 words a minute')).toBeVisible();
    await userEvent.click(canvas.getByRole('radio', { name: /Finish on time/ }));
    await expect(args.onChange).toHaveBeenCalledWith(expect.objectContaining({ scrollMode: 'timed' }));
  },
};

export const FollowMyVoice: Story = { args: { settings: { ...DEFAULT_SETTINGS, scrollMode: 'voice' } } };
