// SPDX-License-Identifier: AGPL-3.0-or-later
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UNDO_MS } from 'zephyrex/hooks/useToast';
import { Toaster } from 'zephyrex/ui/toaster';
import { capabilities, RECORDINGS } from '~/stories/fixtures';
import RecordingsLibrary from './RecordingsLibrary';

const client = vi.hoisted(() => ({
  delete: vi.fn(async () => ({})),
  post: vi.fn(async () => ({})),
  url: (path: string) => `/api${path}`,
}));

vi.mock('zephyrex', async (original) => ({ ...(await original<typeof import('zephyrex')>()), useClient: () => client }));

const [take] = RECORDINGS;
if (take === undefined) throw new Error('The recordings fixture needs a take');

function renderLibrary() {
  const onChanged = vi.fn(async () => undefined);
  render(
    <>
      <RecordingsLibrary recordings={RECORDINGS} capabilities={capabilities({ plans: true, unlocked: () => true })} onChanged={onChanged} />
      <Toaster />
    </>,
  );
  return { onChanged, user: userEvent.setup({ advanceTimers: vi.advanceTimersByTime }) };
}

describe('RecordingsLibrary deletes', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    client.delete.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('hides the take at once and deletes it once the undo window has passed', async () => {
    const { onChanged, user } = renderLibrary();
    await user.click(screen.getByRole('button', { name: `Delete ${take.title}` }));
    expect(screen.queryByText(take.title)).toBeNull();
    expect(client.delete).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(UNDO_MS);
    });
    expect(client.delete).toHaveBeenCalledWith(`/v1/recording/${take.id}`, take);
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('brings the take back on Undo and never deletes it', async () => {
    const { user } = renderLibrary();
    await user.click(screen.getByRole('button', { name: `Delete ${take.title}` }));
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(screen.getByText(take.title)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(UNDO_MS);
    });
    expect(client.delete).not.toHaveBeenCalled();
  });

  it('brings the take back with the reason when the delete fails', async () => {
    client.delete.mockRejectedValueOnce(new Error('The server is busy'));
    const { user } = renderLibrary();
    await user.click(screen.getByRole('button', { name: `Delete ${take.title}` }));
    await act(async () => {
      vi.advanceTimersByTime(UNDO_MS);
    });
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't delete the take: The server is busy");
    expect(screen.getByText(take.title)).toBeInTheDocument();
  });
});
