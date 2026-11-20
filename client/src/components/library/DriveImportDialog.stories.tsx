// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, fn, screen, userEvent, waitFor } from 'storybook/test';
import type { CloudFile } from '~/features/data/records';
import DriveImportDialog from './DriveImportDialog';

const FILES: CloudFile[] = [
  {
    path: 'drive/keynote',
    name: 'Launch keynote',
    mime_type: 'application/vnd.google-apps.document',
    modified_at: '2026-11-18T09:30:00',
    size: null,
    starred: true,
    is_folder: false,
  },
  {
    path: 'drive/notes',
    name: 'Speaker notes.md',
    mime_type: 'text/markdown',
    modified_at: null,
    size: 1200,
    starred: false,
    is_folder: false,
  },
  { path: 'drive/talks', name: 'Talks', mime_type: null, modified_at: null, size: null, starred: false, is_folder: true },
];

const meta: Meta<typeof DriveImportDialog> = {
  title: 'Library/DriveImportDialog',
  component: DriveImportDialog,
  args: { open: true, list: fn(async () => FILES), onPick: fn(), onClose: fn() },
};
export default meta;
type Story = StoryObj<typeof DriveImportDialog>;

export const Files: Story = {
  play: async ({ args }) => {
    // The dialog renders in a portal and fades in: wait for it, then pick a document.
    const keynote = await screen.findByRole('button', { name: /Launch keynote/ });
    await waitFor(() => expect(keynote).toBeVisible());
    // Folders are never offered.
    await expect(screen.queryByRole('button', { name: /Talks/ })).toBeNull();
    await userEvent.click(keynote);
    await expect(args.onPick).toHaveBeenCalledWith(FILES[0]);
  },
};

export const Empty: Story = {
  args: { list: fn(async () => []) },
  play: async () => {
    await waitFor(() => expect(screen.getByText('No Docs or text files in your Drive yet.')).toBeVisible());
  },
};

export const LoadFailed: Story = {
  args: { list: fn(async () => Promise.reject(new Error('Google Drive did not answer'))) },
  play: async ({ args }) => {
    const retry = await screen.findByRole('button', { name: 'Try again' });
    await waitFor(() => expect(retry).toBeVisible());
    await expect(screen.getByText('Google Drive did not answer')).toBeVisible();
    await userEvent.click(retry);
    await waitFor(() => expect(args.list).toHaveBeenCalledTimes(2));
  },
};
