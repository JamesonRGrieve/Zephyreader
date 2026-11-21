// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FOLDERS, SCRIPTS } from '~/stories/fixtures';
import ScriptLibrary, { type ScriptLibraryProps } from './ScriptLibrary';

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/scripts' }));

function renderLibrary(overrides: Partial<ScriptLibraryProps> = {}) {
  const props: ScriptLibraryProps = {
    scripts: SCRIPTS,
    folders: FOLDERS,
    googleDrive: true,
    wordsPerMinute: 150,
    onCreate: vi.fn(),
    onImportFile: vi.fn(),
    onImportDrive: vi.fn(),
    onToggleStar: vi.fn(),
    onDuplicate: vi.fn(),
    onMove: vi.fn(),
    onDelete: vi.fn(),
    onCreateFolder: vi.fn(),
    onRenameFolder: vi.fn(),
    onDeleteFolder: vi.fn(),
    ...overrides,
  };
  render(<ScriptLibrary {...props} />);
  return props;
}

const scriptsRegion = () => within(screen.getByRole('region', { name: 'Scripts' }));

describe('ScriptLibrary', () => {
  beforeEach(() => {
    router.push.mockClear();
  });

  it('shows one folder at a time, and the starred scripts', async () => {
    renderLibrary();
    expect(scriptsRegion().getByText('Weekly team update')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Launch week' }));
    expect(scriptsRegion().queryByText('Weekly team update')).toBeNull();
    expect(scriptsRegion().getByText('Launch keynote')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Starred/ }));
    expect(scriptsRegion().getByText('Launch keynote')).toBeInTheDocument();
    expect(scriptsRegion().queryByText('Weekly team update')).toBeNull();
  });

  it('stars a script, and opens it on the prompter', async () => {
    const props = renderLibrary();
    await userEvent.click(scriptsRegion().getByRole('button', { name: 'Star Weekly team update' }));
    expect(props.onToggleStar).toHaveBeenCalledWith(expect.objectContaining({ id: 'script-weekly' }));
    await userEvent.click(scriptsRegion().getByRole('button', { name: 'Present Launch keynote' }));
    expect(router.push).toHaveBeenCalledWith('/present/script-keynote');
  });

  it('deletes a script from its actions menu', async () => {
    const props = renderLibrary();
    await userEvent.click(scriptsRegion().getByRole('button', { name: 'Weekly team update actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Delete/ }));
    expect(props.onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'script-weekly' }));
  });

  it('offers Google Docs import only where the back end has Drive', async () => {
    renderLibrary({ googleDrive: false });
    await userEvent.click(scriptsRegion().getByRole('button', { name: 'Import' }));
    expect(await screen.findByRole('menuitem', { name: /From a file/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'From Google Docs' })).toBeNull();
  });

  it('says so when a search matches nothing', async () => {
    renderLibrary();
    await userEvent.type(scriptsRegion().getByRole('searchbox', { name: 'Search scripts' }), 'nothing like this');
    expect(scriptsRegion().getByText('No scripts match.')).toBeInTheDocument();
  });
});
