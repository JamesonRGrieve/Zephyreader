// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, fn, userEvent, within } from 'storybook/test';
import { FOLDERS, SCRIPTS } from '~/stories/fixtures';
import ScriptLibrary from './ScriptLibrary';

const meta: Meta<typeof ScriptLibrary> = {
  title: 'Library/Script library',
  component: ScriptLibrary,
  tags: ['autodocs'],
  args: {
    scripts: SCRIPTS,
    folders: FOLDERS,
    googleDrive: true,
    wordsPerMinute: 150,
    onCreate: fn(),
    onImportFile: fn(),
    onImportDrive: fn(),
    onToggleStar: fn(),
    onDuplicate: fn(),
    onMove: fn(),
    onDelete: fn(),
    onCreateFolder: fn(),
    onRenameFolder: fn(),
    onDeleteFolder: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof ScriptLibrary>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const scripts = within(within(canvasElement).getByRole('region', { name: 'Scripts' }));
    // Reading time at the presenter's pace; the day by name, not ambiguous numbers.
    await expect(scripts.getByText(/11 words · about 0:04/)).toBeVisible();
    await userEvent.click(scripts.getByRole('button', { name: 'Star Weekly team update' }));
    await expect(args.onToggleStar).toHaveBeenCalledWith(expect.objectContaining({ id: 'script-weekly' }));
  },
};

export const Searching: Story = {
  play: async ({ canvasElement }) => {
    const scripts = within(within(canvasElement).getByRole('region', { name: 'Scripts' }));
    await userEvent.type(scripts.getByRole('searchbox', { name: 'Search scripts' }), 'weekly');
    await expect(scripts.queryByText('Launch keynote')).toBeNull();
    await expect(scripts.getByText('Weekly team update')).toBeVisible();
  },
};

export const Empty: Story = {
  args: { scripts: [], folders: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/No scripts yet/)).toBeVisible();
  },
};

/** The last script was just deleted and Undo is still on offer: no first-run state yet. */
export const DeletingLast: Story = {
  args: { scripts: [], folders: [], pending: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText(/No scripts yet/)).toBeNull();
  },
};

/** A back end that cannot reach Google Drive offers file import only. */
export const WithoutGoogleDrive: Story = { args: { googleDrive: false } };
