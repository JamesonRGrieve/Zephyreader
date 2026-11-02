// SPDX-License-Identifier: AGPL-3.0-or-later
/** Which scripts the library shows, and in what order. */
import type { Script } from '~/features/data/records';

export type LibraryFilter = { kind: 'all' } | { kind: 'starred' } | { kind: 'folder'; folderId: string };

export const SORTS = ['recent', 'title', 'length'] as const;
export type LibrarySort = (typeof SORTS)[number];

export function filterScripts(scripts: readonly Script[], filter: LibraryFilter, search: string): Script[] {
  const needle = search.trim().toLowerCase();
  return scripts.filter((script) => {
    if (filter.kind === 'starred' && !script.starred) return false;
    if (filter.kind === 'folder' && script.script_folder_id !== filter.folderId) return false;
    if (needle === '') return true;
    return script.title.toLowerCase().includes(needle) || script.content.toLowerCase().includes(needle);
  });
}

export function sortScripts(scripts: readonly Script[], sort: LibrarySort): Script[] {
  const sorted = [...scripts];
  switch (sort) {
    case 'title':
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case 'length':
      return sorted.sort((a, b) => b.word_count - a.word_count);
    case 'recent':
      return sorted.sort((a, b) => (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at));
  }
}

/** A copy's title: "Keynote (copy)", then "Keynote (copy 2)" and on, never clashing. */
export function copyTitle(title: string, existing: readonly string[]): string {
  const base = title.replace(/ \(copy(?: \d+)?\)$/, '');
  const taken = new Set(existing);
  if (!taken.has(`${base} (copy)`)) return `${base} (copy)`;
  let number = 2;
  while (taken.has(`${base} (copy ${number})`)) number += 1;
  return `${base} (copy ${number})`;
}
