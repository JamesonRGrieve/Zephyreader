// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Folder, Script } from '~/features/data/records';
import { DEFAULT_SETTINGS } from '~/features/prompter/settings';
import { capabilities, FOLDERS, SCRIPTS } from '~/stories/fixtures';
import LibraryPage from './LibraryPage';

interface Loaded<T> {
  data: T[] | undefined;
  error: Error | undefined;
  mutate: () => Promise<unknown>;
}

const state = vi.hoisted(() => ({
  scripts: {} as Loaded<Script>,
  folders: {} as Loaded<Folder>,
  actions: {} as Record<string, ReturnType<typeof vi.fn>>,
  router: { push: vi.fn() },
}));

vi.mock('next/navigation', () => ({ useRouter: () => state.router, usePathname: () => '/scripts' }));
vi.mock('~/features/data/records', () => ({
  useScripts: () => state.scripts,
  useFolders: () => state.folders,
  useRecordActions: () => state.actions,
  usePrompterSettings: () => ({ settings: DEFAULT_SETTINGS }),
}));
vi.mock('~/features/capabilities', async (original) => ({
  ...(await original<typeof import('~/features/capabilities')>()),
  useCapabilities: () => capabilities(),
}));

const loaded = <T,>(data: T[] | undefined, error?: Error): Loaded<T> => ({
  data,
  error,
  mutate: vi.fn().mockResolvedValue(undefined),
});
const scriptsRegion = () => within(screen.getByRole('region', { name: 'Scripts' }));

describe('LibraryPage', () => {
  beforeEach(() => {
    state.scripts = loaded(SCRIPTS);
    state.folders = loaded(FOLDERS);
    state.actions = {
      createScript: vi.fn(async (fields: Partial<Script>) => ({ ...SCRIPTS[0], ...fields, id: 'script-new' })),
      updateScript: vi.fn(async (script: Script, changes: Partial<Script>) => ({ ...script, ...changes })),
      deleteScript: vi.fn().mockResolvedValue(undefined),
      createFolder: vi.fn().mockResolvedValue(FOLDERS[0]),
      renameFolder: vi.fn().mockResolvedValue(FOLDERS[0]),
      deleteFolder: vi.fn().mockResolvedValue(undefined),
      listDrive: vi.fn().mockResolvedValue([]),
      readDrive: vi.fn(),
    };
    state.router.push.mockClear();
  });

  it('shows a skeleton until both the scripts and the folders are in', () => {
    state.folders = loaded<Folder>(undefined);
    render(<LibraryPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading your scripts…');
  });

  it('says the library could not be loaded, and loads both lists again on Try again', async () => {
    state.scripts = loaded<Script>(undefined, new Error('The server is busy'));
    render(<LibraryPage />);
    expect(screen.getByText('The server is busy')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(state.scripts.mutate).toHaveBeenCalled();
    expect(state.folders.mutate).toHaveBeenCalled();
  });

  it('opens a new, untitled script in the editor', async () => {
    render(<LibraryPage />);
    await userEvent.click(screen.getByRole('button', { name: 'New script' }));
    expect(state.actions.createScript).toHaveBeenCalledWith({ title: 'Untitled script', content: '' });
    expect(state.router.push).toHaveBeenCalledWith('/script/script-new');
  });

  it('stars a script, and names a duplicate so it never clashes', async () => {
    render(<LibraryPage />);
    const update = SCRIPTS.find((script) => script.title === 'Weekly team update') as Script;
    await userEvent.click(screen.getByRole('button', { name: 'Star Weekly team update' }));
    expect(state.actions.updateScript).toHaveBeenCalledWith(update, { starred: true });
    await userEvent.click(screen.getByRole('button', { name: 'Weekly team update actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Duplicate' }));
    expect(state.actions.createScript).toHaveBeenCalledWith({
      title: 'Weekly team update (copy)',
      content: update.content,
      script_folder_id: update.script_folder_id,
    });
  });

  it('takes a deleted script off the list at once, and leaves the server delete until Undo has gone', async () => {
    render(<LibraryPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Weekly team update actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    expect(scriptsRegion().queryByRole('button', { name: 'Weekly team update actions' })).toBeNull();
    expect(state.actions.deleteScript).not.toHaveBeenCalled();
  });

  it('creates a folder from the name given', async () => {
    render(<LibraryPage />);
    await userEvent.click(screen.getByRole('button', { name: 'New folder' }));
    await userEvent.type(await screen.findByLabelText('Folder name'), 'Conference');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(state.actions.createFolder).toHaveBeenCalledWith('Conference');
  });

  it('says what failed and why, without leaving the page', async () => {
    state.actions.updateScript = vi.fn().mockRejectedValue(new Error('Someone else changed it'));
    render(<LibraryPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Star Weekly team update' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Couldn't star the script.*Someone else changed it/);
    expect(scriptsRegion().getByText('Launch keynote')).toBeInTheDocument();
  });
});
