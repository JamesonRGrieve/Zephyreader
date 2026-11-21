// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AI_ACTIONS } from '~/contract';
import AiPanel, { AI_ACTION_LABELS } from './AiPanel';

describe('AiPanel', () => {
  it('names every action the server takes', () => {
    for (const action of AI_ACTIONS) expect(AI_ACTION_LABELS[action]).toMatch(/\S/);
  });

  it('shortens the script by default and hands back the result', async () => {
    const run = vi.fn().mockResolvedValue('Shorter.');
    const onResult = vi.fn();
    render(<AiPanel content='A much longer opening.' run={run} onResult={onResult} />);
    await userEvent.click(screen.getByRole('button', { name: 'Shorten the script' }));
    expect(run).toHaveBeenCalledWith({ action: 'shorten', content: 'A much longer opening.' });
    expect(onResult).toHaveBeenCalledWith('Shorter.');
    expect(screen.getByText(/You can undo it from the editor/)).toBeInTheDocument();
  });

  it('translates into the language asked for', async () => {
    const run = vi.fn().mockResolvedValue('Bonsoir.');
    render(<AiPanel content='Good evening.' run={run} onResult={vi.fn()} />);
    await userEvent.click(screen.getByRole('combobox', { name: 'What the writer does' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Translate' }));
    const language = screen.getByLabelText('Language');
    await userEvent.clear(language);
    await userEvent.type(language, 'Spanish');
    await userEvent.click(screen.getByRole('button', { name: 'Translate the script' }));
    expect(run).toHaveBeenCalledWith({ action: 'translate', content: 'Good evening.', language: 'Spanish' });
  });

  it('needs something to work on', () => {
    render(<AiPanel content='   ' run={vi.fn()} onResult={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Shorten the script' })).toBeDisabled();
  });

  it('says why the writer failed, and leaves the script alone', async () => {
    const onResult = vi.fn();
    render(
      <AiPanel
        content='Good evening.'
        run={vi.fn().mockRejectedValue(new Error('No AI provider is configured'))}
        onResult={onResult}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Shorten the script' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No AI provider is configured');
    expect(onResult).not.toHaveBeenCalled();
  });

  it('heads itself at the level the page asks for', () => {
    render(<AiPanel content='x' run={vi.fn()} onResult={vi.fn()} headingLevel={3} />);
    expect(screen.getByRole('heading', { level: 3, name: 'AI writer' })).toBeInTheDocument();
  });
});
