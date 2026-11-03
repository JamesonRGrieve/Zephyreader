// SPDX-License-Identifier: AGPL-3.0-or-later
/** Records and capabilities the stories render with: what the API answers, shaped as it answers. */
import type { Capabilities } from '~/features/capabilities';
import type { Folder, Recording, Script } from '~/features/data/records';

const STAMP = '2026-11-02T10:00:00.000000';

export const KEYNOTE_TEXT = `# Opening

Good evening, everyone. [smile, pause] Thank you for joining us tonight.

We built **Zephyreader** for anyone who speaks to a camera and wants to look up, not down.

## Close

Thank you. [wave]`;

export const FOLDERS: Folder[] = [{ id: 'folder-launch', name: 'Launch week', created_at: STAMP, updated_at: STAMP }];

export const KEYNOTE: Script = {
  id: 'script-keynote',
  title: 'Launch keynote',
  content: KEYNOTE_TEXT,
  starred: true,
  word_count: 30,
  script_folder_id: 'folder-launch',
  source_provider: null,
  source_path: null,
  created_at: STAMP,
  updated_at: STAMP,
};

export const SCRIPTS: Script[] = [
  KEYNOTE,
  {
    ...KEYNOTE,
    id: 'script-weekly',
    title: 'Weekly team update',
    content: 'Here is what we shipped this week, and what comes next.',
    word_count: 11,
    starred: false,
    script_folder_id: null,
  },
];

export const RECORDINGS: Recording[] = [
  {
    id: 'recording-take-1',
    title: 'Launch keynote, take 1',
    mime_type: 'video/webm',
    duration_seconds: 34,
    size_bytes: 12 * 1024 * 1024,
    script_id: KEYNOTE.id,
    storage_path: 'recordings/user/take-1.webm',
    transcript: null,
    caption_segments: null,
    created_at: STAMP,
    updated_at: STAMP,
  },
];

/** A back end's capabilities: lite by default (no plans), with `overrides`. */
export function capabilities(overrides: Partial<Capabilities> = {}): Capabilities {
  return { loaded: true, liveSync: true, googleDrive: true, plans: false, unlocked: () => false, ...overrides };
}
