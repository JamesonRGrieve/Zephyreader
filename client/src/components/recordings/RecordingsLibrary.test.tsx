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

  it('shows the empty state once the last take is deleted and the list refreshed', async () => {
    const onChanged = vi.fn(async () => undefined);
    const { rerender } = render(
      <RecordingsLibrary recordings={[take]} capabilities={capabilities({ plans: true, unlocked: () => true })} onChanged={onChanged} />,
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole('button', { name: `Delete ${take.title}` }));
    // While the delete can still be undone the empty state is not asserted: under the framework's
    // rule (useHidden's `pending`, client-framework batch B1) it must not show until the delete is done.
    await act(async () => {
      vi.advanceTimersByTime(UNDO_MS);
    });
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalled());
    // useWrites keeps a removed id hidden; the view counts only loaded takes, so the empty state stays right.
    rerender(<RecordingsLibrary recordings={[]} capabilities={capabilities({ plans: true, unlocked: () => true })} onChanged={onChanged} />);
    expect(screen.getByText(/No recordings yet/)).toBeInTheDocument();
  });

  it('brings the take back with the reason when the delete fails', async () => {
    client.delete.mockRejectedValueOnce(new Error('The server is busy'));
    const { user } = renderLibrary();
    await user.click(screen.getByRole('button', { name: `Delete ${take.title}` }));
    await act(async () => {
      vi.advanceTimersByTime(UNDO_MS);
    });
    // Found by its text: the framework's toast store is module-level, so another test's notice may still be up.
    expect(await screen.findByText('The server is busy')).toHaveAttribute('role', 'alert');
    expect(await screen.findByText("Couldn't delete the take")).toBeInTheDocument();
    expect(screen.getByText(take.title)).toBeInTheDocument();
  });
});
