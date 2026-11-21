// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CloudFile } from '~/features/data/records';
import DriveImportDialog from './DriveImportDialog';

const file = (fields: Partial<CloudFile>): CloudFile => ({
  path: 'drive/x',
  name: 'x',
  mime_type: 'text/plain',
  modified_at: null,
  size: null,
  starred: false,
  is_folder: false,
  ...fields,
});

const KEYNOTE = file({ path: 'drive/keynote', name: 'Launch keynote', starred: true });
const TALKS = file({ path: 'drive/talks', name: 'Talks', is_folder: true });

describe('DriveImportDialog', () => {
  it('lists the Docs and text files, never folders, and imports the one picked', async () => {
    const onPick = vi.fn();
    render(<DriveImportDialog open list={vi.fn().mockResolvedValue([KEYNOTE, TALKS])} onPick={onPick} onClose={vi.fn()} />);
    const keynote = await screen.findByRole('button', { name: /Launch keynote/ });
    expect(screen.getByLabelText('Starred')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Talks/ })).toBeNull();
    await userEvent.click(keynote);
    expect(onPick).toHaveBeenCalledWith(KEYNOTE);
  });

  it('searches the Drive with what is typed', async () => {
    const list = vi.fn().mockResolvedValue([]);
    render(<DriveImportDialog open list={list} onPick={vi.fn()} onClose={vi.fn()} />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search your Drive' }), 'agenda');
    await waitFor(() => expect(list).toHaveBeenLastCalledWith('agenda'));
    expect(await screen.findByText('Nothing in your Drive matches "agenda".')).toBeInTheDocument();
  });

  it('says why the Drive could not be read, and asks again on Try again', async () => {
    const list = vi.fn().mockRejectedValueOnce(new Error('Google Drive did not answer')).mockResolvedValue([]);
    render(<DriveImportDialog open list={list} onPick={vi.fn()} onClose={vi.fn()} />);
    expect(await screen.findByText('Google Drive did not answer')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No Docs or text files in your Drive yet.')).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('asks nothing of the Drive while closed, even past the search pause', () => {
    vi.useFakeTimers();
    try {
      const list = vi.fn().mockResolvedValue([]);
      render(<DriveImportDialog open={false} list={list} onPick={vi.fn()} onClose={vi.fn()} />);
      vi.advanceTimersByTime(5_000);
      expect(list).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
