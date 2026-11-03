// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, fn, within } from 'storybook/test';
import { withZephyrexApi } from 'zephyrex/testing';
import { capabilities, KEYNOTE } from '~/stories/fixtures';
import ScriptEditor from './ScriptEditor';

const meta: Meta<typeof ScriptEditor> = {
  title: 'Editor/Script editor',
  component: ScriptEditor,
  tags: ['autodocs'],
  decorators: [withZephyrexApi],
  args: {
    script: KEYNOTE,
    capabilities: capabilities(),
    write: fn(async (seen, changes) => ({ ...seen, ...changes })),
    rewrite: fn(async () => ''),
    wordsPerMinute: 150,
  },
};
export default meta;
type Story = StoryObj<typeof ScriptEditor>;

/** Spoken words only: cue notes and markup are not counted. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText('Title')).toHaveValue('Launch keynote');
    await expect(canvas.getByText(/30 words · about 0:12/)).toBeVisible();
    await expect(canvas.getByRole('toolbar', { name: 'Formatting' })).toBeVisible();
  },
};
