// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, fn, userEvent, within } from 'storybook/test';
import { KEYNOTE_TEXT } from '~/stories/fixtures';
import AiPanel from './AiPanel';

const meta: Meta<typeof AiPanel> = {
  title: 'Editor/AI writer',
  component: AiPanel,
  tags: ['autodocs'],
  args: { content: KEYNOTE_TEXT, run: fn(async () => 'A shorter keynote.'), onResult: fn() },
};
export default meta;
type Story = StoryObj<typeof AiPanel>;

export const Shortening: Story = {
  play: async ({ canvasElement, args }) => {
    const panel = within(canvasElement).getByRole('region', { name: 'AI writer' });
    await userEvent.click(within(panel).getByRole('button', { name: 'Shorten the script' }));
    await expect(args.run).toHaveBeenCalledWith(expect.objectContaining({ action: 'shorten', content: KEYNOTE_TEXT }));
    await expect(args.onResult).toHaveBeenCalledWith('A shorter keynote.');
  },
};

/** A writer that cannot answer says so, rather than failing silently. */
export const Unavailable: Story = {
  args: { run: fn(async () => Promise.reject(new Error('No AI provider is configured'))) },
  play: async ({ canvasElement }) => {
    const panel = within(canvasElement).getByRole('region', { name: 'AI writer' });
    await userEvent.click(within(panel).getByRole('button', { name: 'Shorten the script' }));
    await expect(await within(panel).findByRole('alert')).toHaveTextContent('No AI provider is configured');
  },
};
