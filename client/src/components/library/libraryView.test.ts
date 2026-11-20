// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import type { Script } from '~/features/data/records';
import { KEYNOTE } from '~/stories/fixtures';
import { copyTitle, filterScripts, sortScripts } from './libraryView';

const script = (fields: Partial<Script>): Script => ({ ...KEYNOTE, ...fields });

const KEYNOTE_DRAFT = script({
  id: 'keynote',
  title: 'Keynote',
  content: 'Good evening, everyone.',
  starred: true,
  word_count: 3,
  script_folder_id: 'launch',
  created_at: '2026-11-01T09:00:00',
  updated_at: '2026-11-03T09:00:00',
});
const STANDUP = script({
  id: 'standup',
  title: 'Standup',
  content: 'Yesterday I shipped the remote.',
  starred: false,
  word_count: 5,
  script_folder_id: null,
  created_at: '2026-11-02T09:00:00',
  updated_at: null,
});
const ANTHEM = script({
  id: 'anthem',
  title: 'Anthem',
  content: 'Sing along with the launch.',
  starred: false,
  word_count: 5,
  script_folder_id: 'launch',
  created_at: '2026-11-04T09:00:00',
  updated_at: '2026-11-04T10:00:00',
});
const ALL = [KEYNOTE_DRAFT, STANDUP, ANTHEM];
const ids = (scripts: readonly Script[]) => scripts.map((found) => found.id);

describe('filterScripts', () => {
  it('shows everything, the starred ones, or one folder', () => {
    expect(ids(filterScripts(ALL, { kind: 'all' }, ''))).toEqual(['keynote', 'standup', 'anthem']);
    expect(ids(filterScripts(ALL, { kind: 'starred' }, ''))).toEqual(['keynote']);
    expect(ids(filterScripts(ALL, { kind: 'folder', folderId: 'launch' }, ''))).toEqual(['keynote', 'anthem']);
  });

  it('searches titles and words, ignoring case and surrounding spaces', () => {
    expect(ids(filterScripts(ALL, { kind: 'all' }, '  LAUNCH '))).toEqual(['anthem']);
    expect(ids(filterScripts(ALL, { kind: 'all' }, 'standup'))).toEqual(['standup']);
    expect(ids(filterScripts(ALL, { kind: 'folder', folderId: 'launch' }, 'evening'))).toEqual(['keynote']);
    expect(filterScripts(ALL, { kind: 'starred' }, 'remote')).toEqual([]);
  });
});

describe('sortScripts', () => {
  it('orders by title, by length, or by the latest change', () => {
    expect(ids(sortScripts(ALL, 'title'))).toEqual(['anthem', 'keynote', 'standup']);
    expect(ids(sortScripts(ALL, 'length'))).toEqual(['standup', 'anthem', 'keynote']);
    // A script never edited counts from when it was made.
    expect(ids(sortScripts(ALL, 'recent'))).toEqual(['anthem', 'keynote', 'standup']);
  });

  it('leaves the list it was given as it was', () => {
    const given = [...ALL];
    sortScripts(given, 'title');
    expect(ids(given)).toEqual(['keynote', 'standup', 'anthem']);
  });
});

describe('copyTitle', () => {
  it('names a copy, then numbers further copies without clashing', () => {
    expect(copyTitle('Keynote', ['Keynote'])).toBe('Keynote (copy)');
    expect(copyTitle('Keynote', ['Keynote', 'Keynote (copy)'])).toBe('Keynote (copy 2)');
    expect(copyTitle('Keynote', ['Keynote', 'Keynote (copy)', 'Keynote (copy 2)'])).toBe('Keynote (copy 3)');
  });

  it('copies a copy from the original name, not "(copy) (copy)"', () => {
    expect(copyTitle('Keynote (copy)', ['Keynote', 'Keynote (copy)'])).toBe('Keynote (copy 2)');
    expect(copyTitle('Keynote (copy 2)', ['Keynote', 'Keynote (copy)', 'Keynote (copy 2)'])).toBe('Keynote (copy 3)');
  });
});
