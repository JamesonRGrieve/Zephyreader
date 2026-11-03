// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, fn, within } from 'storybook/test';
import { withZephyrexApi } from 'zephyrex/testing';
import { capabilities, RECORDINGS } from '~/stories/fixtures';
import RecordingsLibrary from './RecordingsLibrary';

const meta: Meta<typeof RecordingsLibrary> = {
  title: 'Recordings/Library',
  component: RecordingsLibrary,
  tags: ['autodocs'],
  decorators: [withZephyrexApi],
  args: {
    recordings: RECORDINGS,
    capabilities: capabilities({ plans: true, unlocked: () => true }),
    onChanged: fn(async () => undefined),
  },
};
export default meta;
type Story = StoryObj<typeof RecordingsLibrary>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const library = within(within(canvasElement).getByRole('region', { name: 'Your recordings' }));
    await expect(library.getByText('Launch keynote, take 1')).toBeVisible();
    await expect(library.getByRole('button', { name: 'Delete Launch keynote, take 1' })).toBeVisible();
  },
};

export const Empty: Story = {
  args: { recordings: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/No recordings yet/)).toBeVisible();
  },
};
