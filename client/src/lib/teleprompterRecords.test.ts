// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The lite records against this worker's own migrated database (workerDatabase.ts): owners,
 * the version guard, the server-kept word count, folders, team refusal and one settings
 * record per person. The routes over them are tested in app/api/v1/script/routes.test.ts and
 * held to server-framework's answers by e2e/contract.spec.ts.
 */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ApiError } from '~/lib/apiErrors';
import { prompterPreferences, scriptFolders, scripts } from './teleprompterRecords';

const owner = () => `user-${randomUUID()}`;
const NOW = new Date('2026-11-20T21:00:00.000Z');
const LATER = new Date('2026-11-20T21:05:00.000Z');

const scriptInput = (fields: Partial<Parameters<typeof scripts.insert>[1]> = {}) =>
  scripts.createSchema.parse({ title: 'Keynote', content: 'Good evening [smile] everyone.', ...fields });

describe('scripts', () => {
  it('keeps each person’s scripts to them', async () => {
    const ada = owner();
    const grace = owner();
    const made = await scripts.insert(ada, scriptInput(), NOW);
    expect(await scripts.find(made.id, ada)).not.toBeNull();
    expect(await scripts.find(made.id, grace)).toBeNull();
    expect((await scripts.list(grace)).map((row) => row.id)).not.toContain(made.id);
  });

  it('counts the spoken words itself, whatever the client sends', async () => {
    const made = await scripts.insert(owner(), scriptInput({ word_count: 999 }), NOW);
    expect(made.wordCount).toBe(3);
    expect(scripts.fields(made)).toMatchObject({ word_count: 3, team_id: null });
  });

  it('applies an update only at the version it was made against', async () => {
    const ada = owner();
    const made = await scripts.insert(ada, scriptInput(), NOW);
    const updated = await scripts.updateIfCurrent(made.id, NOW, { content: 'One two three four.' }, LATER, ada);
    expect(updated).toMatchObject({ content: 'One two three four.', wordCount: 4, updatedById: ada });
    // The same version again is stale now: nothing is written.
    expect(await scripts.updateIfCurrent(made.id, NOW, { title: 'Stale' }, LATER, ada)).toBeNull();
  });

  it('files a script only in a folder of its owner’s', async () => {
    const ada = owner();
    const folder = await scriptFolders.insert(ada, scriptFolders.createSchema.parse({ name: 'Launch week' }), NOW);
    const filed = await scripts.insert(ada, scriptInput({ script_folder_id: folder.id }), NOW);
    expect(filed.scriptFolderId).toBe(folder.id);
    await expect(scripts.insert(owner(), scriptInput({ script_folder_id: folder.id }), NOW)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('refuses team sharing as the free plan does (lite has no teams)', async () => {
    const refusal = scripts.insert(owner(), scriptInput({ team_id: 'team-1' }), NOW);
    await expect(refusal).rejects.toBeInstanceOf(ApiError);
    await expect(refusal).rejects.toMatchObject({ status: 402, detail: { feature: 'team_sharing', upgrade_to: ['team'] } });
  });

  it('holds titles to the shared limits', () => {
    expect(scripts.createSchema.safeParse({ title: '' }).success).toBe(false);
    expect(scripts.createSchema.safeParse({ title: 'x'.repeat(10_000) }).success).toBe(false);
  });
});

describe('prompter preferences', () => {
  it('keeps one settings record per person', async () => {
    const ada = owner();
    await prompterPreferences.beforeCreate?.(ada);
    const made = await prompterPreferences.insert(
      ada,
      prompterPreferences.createSchema.parse({ settings: { speed: 140 } }),
      NOW,
    );
    expect(prompterPreferences.fields(made)).toEqual({ settings: { speed: 140 } });
    await expect(prompterPreferences.beforeCreate?.(ada)).rejects.toMatchObject({ status: 409 });
  });

  it('starts from empty settings when none are sent', async () => {
    const made = await prompterPreferences.insert(owner(), prompterPreferences.createSchema.parse({}), NOW);
    expect(prompterPreferences.fields(made)).toEqual({ settings: {} });
  });
});
