// SPDX-License-Identifier: AGPL-3.0-or-later
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StaleWriteError } from 'zephyrex';
import type { Capabilities } from '~/features/capabilities';
import type { Script } from '~/features/data/records';
import { capabilities, KEYNOTE } from '~/stories/fixtures';
import ScriptEditor, { AUTOSAVE_DELAY_MS } from './ScriptEditor';

type Write = (seen: Script, changes: Partial<Script>) => Promise<Script>;

/** The editor as its page holds it: the script it shows is the one the last save answered with. */
function Page({ write, can = capabilities() }: { write: Write; can?: Capabilities }) {
  const [script, setScript] = useState(KEYNOTE);
  return (
    <ScriptEditor
      script={script}
      capabilities={can}
      write={async (seen, changes) => {
        const saved = await write(seen, changes);
        setScript(saved);
        return saved;
      }}
      rewrite={vi.fn()}
      wordsPerMinute={150}
    />
  );
}

const saves: Write = async (seen, changes) => ({ ...seen, ...changes, updated_at: '2026-11-21T02:00:00' });
const pause = () => act(async () => void vi.advanceTimersByTime(AUTOSAVE_DELAY_MS));

describe('ScriptEditor', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows the script with its spoken words and reading time, saved', () => {
    render(<Page write={saves} />);
    expect(screen.getByLabelText('Title')).toHaveValue('Launch keynote');
    expect(screen.getByText(/30 words · about 0:12 · Saved/)).toBeInTheDocument();
  });

  it('saves itself when typing pauses, and only what changed', async () => {
    const write = vi.fn(saves);
    render(<Page write={write} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Launch keynote, final' } });
    expect(screen.getByText(/Unsaved changes/)).toBeInTheDocument();
    expect(write).not.toHaveBeenCalled();
    await pause();
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(KEYNOTE, { title: 'Launch keynote, final' });
    expect(screen.getByText(/· Saved/)).toBeInTheDocument();
  });

  it('never saves a script without a title, and says why', async () => {
    const write = vi.fn(saves);
    render(<Page write={write} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '   ' } });
    expect(screen.getByText('A script needs a title.')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true');
    await pause();
    expect(write).not.toHaveBeenCalled();
  });

  it('keeps the changes when the script changed elsewhere, and lets the other version win', async () => {
    const theirs = { ...KEYNOTE, title: 'Their title', updated_at: '2026-11-21T01:59:00' };
    const write = vi.fn<Write>().mockRejectedValue(new StaleWriteError(JSON.stringify({ current: theirs })));
    render(<Page write={write} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'My title' } });
    await pause();
    expect(screen.getByRole('alert')).toHaveTextContent('This script was changed somewhere else');
    expect(screen.getByLabelText('Title')).toHaveValue('My title');
    // No second save is tried while the conflict is up.
    await pause();
    expect(write).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Use the other version' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('wraps the selected words in the formatting asked for', () => {
    render(<Page write={saves} />);
    const script = screen.getByLabelText('Script') as HTMLTextAreaElement;
    fireEvent.change(script, { target: { value: 'Good evening, everyone.' } });
    script.setSelectionRange(5, 12);
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(script).toHaveValue('Good **evening**, everyone.');
  });

  it('offers the remote control only where screens can sync', () => {
    const { unmount } = render(<Page write={saves} />);
    expect(screen.getByRole('link', { name: /Remote control/ })).toHaveAttribute('href', `/remote?script=${KEYNOTE.id}`);
    expect(screen.getByRole('link', { name: /Present/ })).toHaveAttribute('href', `/present/${KEYNOTE.id}`);
    unmount();
    render(<Page write={saves} can={capabilities({ liveSync: false })} />);
    expect(screen.queryByRole('link', { name: /Remote control/ })).not.toBeInTheDocument();
  });
});
