// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The UI reads records through these schemas: whatever the lite back end answers must parse.
 * (The SaaS back end is held to the same shapes by e2e/contract.spec.ts.)
 */
import type { Script as ScriptRow, ScriptFolder } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { toDto } from '~/lib/records';
import { scriptFolders, scripts } from '~/lib/teleprompterRecords';
import { FOLDERS_KEY, folderSchema, PREFERENCES_KEY, RECORDINGS_KEY, SCRIPTS_KEY, scriptSchema } from './records';

const STAMP = new Date('2026-11-20T21:00:00.000Z');

const SCRIPT_ROW: ScriptRow = {
  id: 'script-1',
  createdById: 'user-ada',
  scriptFolderId: null,
  title: 'Keynote',
  content: 'Good evening.',
  starred: true,
  wordCount: 2,
  sourceProvider: null,
  sourcePath: null,
  createdAt: STAMP,
  updatedAt: STAMP,
  updatedById: null,
};

const FOLDER_ROW: ScriptFolder = {
  id: 'folder-1',
  createdById: 'user-ada',
  name: 'Launch week',
  createdAt: STAMP,
  updatedAt: STAMP,
  updatedById: null,
};

describe('record schemas', () => {
  it('read a script exactly as the lite back end answers it', () => {
    const read = scriptSchema.parse(toDto(scripts, SCRIPT_ROW));
    expect(read).toMatchObject({ id: 'script-1', title: 'Keynote', word_count: 2, starred: true, script_folder_id: null });
  });

  it('read a folder exactly as the lite back end answers it', () => {
    expect(folderSchema.parse(toDto(scriptFolders, FOLDER_ROW))).toMatchObject({ id: 'folder-1', name: 'Launch week' });
  });

  it('refuse an answer missing a field the UI relies on', () => {
    const partial = Object.fromEntries(Object.entries(toDto(scripts, SCRIPT_ROW)).filter(([key]) => key !== 'word_count'));
    expect(scriptSchema.safeParse(partial).success).toBe(false);
  });
});

describe('record paths', () => {
  it('are the framework resources both back ends serve', () => {
    expect([SCRIPTS_KEY, FOLDERS_KEY, PREFERENCES_KEY, RECORDINGS_KEY]).toEqual([
      `/v1/${scripts.resource}`,
      `/v1/${scriptFolders.resource}`,
      '/v1/prompter_preference',
      '/v1/recording',
    ]);
  });
});
