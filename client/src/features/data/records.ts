// SPDX-License-Identifier: AGPL-3.0-or-later
'use client';
/**
 * The records the UI reads and writes, through the framework client: the same calls
 * whichever back end answers (docs/FEATURES.md). Every change is guarded by the version
 * the user saw (If-Match); a stale one surfaces as a conflict, never a silent overwrite.
 */
import { csrfHeaders } from '@zephyrex/auth/lib/session';
import useSWR, { useSWRConfig, type SWRResponse } from 'swr';
import { etagOf, useClient } from 'zephyrex';
import { z } from 'zod';
import { DEFAULT_SETTINGS, readSettings, type PrompterSettings } from '~/features/prompter/settings';

const versioned = { id: z.string(), created_at: z.string(), updated_at: z.string().nullable() };

export const scriptSchema = z.object({
  ...versioned,
  title: z.string(),
  content: z.string(),
  starred: z.boolean(),
  word_count: z.number(),
  script_folder_id: z.string().nullable(),
  source_provider: z.string().nullable(),
  source_path: z.string().nullable(),
});
export type Script = z.infer<typeof scriptSchema>;

export const folderSchema = z.object({ ...versioned, name: z.string() });
export type Folder = z.infer<typeof folderSchema>;

export const preferenceSchema = z.object({ ...versioned, settings: z.record(z.string(), z.unknown()) });
export type Preference = z.infer<typeof preferenceSchema>;

export const recordingSchema = z.object({
  ...versioned,
  title: z.string(),
  mime_type: z.string(),
  duration_seconds: z.number().nullable(),
  size_bytes: z.number(),
  script_id: z.string().nullable(),
  storage_path: z.string().nullable(),
  transcript: z.string().nullable(),
  caption_segments: z.array(z.unknown()).nullable(),
});
export type Recording = z.infer<typeof recordingSchema>;

export const cloudFileSchema = z.object({
  path: z.string(),
  name: z.string(),
  mime_type: z.string().nullable(),
  modified_at: z.string().nullable(),
  size: z.number().nullable(),
  starred: z.boolean(),
  is_folder: z.boolean(),
});
export type CloudFile = z.infer<typeof cloudFileSchema>;

export const SCRIPTS_KEY = '/v1/script';
export const FOLDERS_KEY = '/v1/script_folder';
export const PREFERENCES_KEY = '/v1/prompter_preference';
export const RECORDINGS_KEY = '/v1/recording';

/** The record a single-record answer wraps (`{ <resource>: {...} }`). */
function one<T>(schema: z.ZodType<T>, key: string, body: unknown): T {
  return schema.parse(z.record(z.string(), z.unknown()).parse(body)[key]);
}

export function useScripts(): SWRResponse<Script[], Error> {
  const client = useClient();
  return useSWR(SCRIPTS_KEY, () => client.list(SCRIPTS_KEY, 'scripts', scriptSchema));
}

export function useScript(id: string): SWRResponse<Script, Error> {
  const client = useClient();
  return useSWR(`${SCRIPTS_KEY}/${id}`, async () => one(scriptSchema, 'script', await client.get(`${SCRIPTS_KEY}/${id}`)));
}

export function useFolders(): SWRResponse<Folder[], Error> {
  const client = useClient();
  return useSWR(FOLDERS_KEY, () => client.list(FOLDERS_KEY, 'script_folders', folderSchema));
}

export function useRecordings(enabled: boolean): SWRResponse<Recording[], Error> {
  const client = useClient();
  return useSWR(enabled ? RECORDINGS_KEY : null, () => client.list(RECORDINGS_KEY, 'recordings', recordingSchema));
}

export type ScriptFields = Pick<Script, 'title' | 'content'> &
  Partial<Pick<Script, 'starred' | 'script_folder_id' | 'source_provider' | 'source_path'>>;

/** The calls that change records; each answers with the record as the server now has it. */
export function useRecordActions() {
  const client = useClient();
  const { mutate } = useSWRConfig();
  /** Runs a change, then has every list showing that resource read it again. */
  const changing = async <T>(key: string, change: Promise<T>): Promise<T> => {
    const result = await change;
    await mutate(key);
    return result;
  };
  return {
    createScript: async (fields: ScriptFields): Promise<Script> =>
      changing(SCRIPTS_KEY, client.post(SCRIPTS_KEY, { script: fields })).then((body) => one(scriptSchema, 'script', body)),
    updateScript: async (seen: Script, changes: Partial<Script>): Promise<Script> =>
      changing(SCRIPTS_KEY, client.put(`${SCRIPTS_KEY}/${seen.id}`, { script: changes }, seen)).then((body) =>
        one(scriptSchema, 'script', body),
      ),
    deleteScript: async (seen: Script): Promise<void> => {
      await changing(SCRIPTS_KEY, client.delete(`${SCRIPTS_KEY}/${seen.id}`, seen));
    },
    createFolder: async (name: string): Promise<Folder> =>
      changing(FOLDERS_KEY, client.post(FOLDERS_KEY, { script_folder: { name } })).then((body) =>
        one(folderSchema, 'script_folder', body),
      ),
    renameFolder: async (seen: Folder, name: string): Promise<Folder> =>
      changing(FOLDERS_KEY, client.put(`${FOLDERS_KEY}/${seen.id}`, { script_folder: { name } }, seen)).then((body) =>
        one(folderSchema, 'script_folder', body),
      ),
    deleteFolder: async (seen: Folder): Promise<void> => {
      // A folder's scripts stay, outside any folder: both lists change.
      await changing(FOLDERS_KEY, client.delete(`${FOLDERS_KEY}/${seen.id}`, seen));
      await mutate(SCRIPTS_KEY);
    },
    listDrive: async (search: string): Promise<CloudFile[]> =>
      z
        .object({ files: z.array(cloudFileSchema) })
        .parse(await client.get('/v1/cloud/google_drive/files', search === '' ? {} : { search })).files,
    readDrive: async (path: string): Promise<CloudFile & { content: string }> =>
      z
        .object({ file: cloudFileSchema.extend({ content: z.string() }) })
        .parse(await client.get('/v1/cloud/google_drive/file', { path })).file,
    /** A take into the recordings library: its record, then its video (guarded by the record's version). */
    uploadTake: async (
      take: { blob: Blob; mimeType: string; durationSeconds: number },
      title: string,
      scriptId: string,
    ): Promise<void> => {
      const created = one(
        recordingSchema,
        'recording',
        await client.post(RECORDINGS_KEY, {
          recording: { title, mime_type: take.mimeType, duration_seconds: take.durationSeconds, script_id: scriptId },
        }),
      );
      const response = await fetch(client.url(`${RECORDINGS_KEY}/${created.id}/content`), {
        method: 'PUT',
        headers: { 'Content-Type': take.mimeType.split(';')[0], 'If-Match': etagOf(created), ...csrfHeaders('PUT') },
        body: take.blob,
      });
      if (!response.ok)
        throw new Error(response.status === 402 ? 'Your plan has no room for this take' : 'The take could not be uploaded');
    },
    rewrite: async (request: { action: string; content: string; tone?: string; language?: string }): Promise<string> =>
      z.object({ content: z.string() }).parse(await client.post('/v1/teleprompter/ai', request)).content,
  };
}

/**
 * The user's prompter settings: read from their preference record (or the defaults), and
 * saved to it, creating it on the first save.
 */
export function usePrompterSettings(): {
  settings: PrompterSettings;
  loaded: boolean;
  /** Why the saved settings didn't load; the defaults stand in meanwhile. */
  error: Error | undefined;
  retry: () => Promise<unknown>;
  save: (settings: PrompterSettings) => Promise<void>;
} {
  const client = useClient();
  const preferences = useSWR(PREFERENCES_KEY, () => client.list(PREFERENCES_KEY, 'prompter_preferences', preferenceSchema));
  const record = preferences.data?.[0];
  return {
    settings: record === undefined ? DEFAULT_SETTINGS : readSettings(record.settings),
    loaded: preferences.data !== undefined || preferences.error !== undefined,
    error: preferences.error instanceof Error ? preferences.error : undefined,
    retry: () => preferences.mutate(),
    save: async (settings) => {
      const saved =
        record === undefined
          ? one(
              preferenceSchema,
              'prompter_preference',
              await client.post(PREFERENCES_KEY, { prompter_preference: { settings } }),
            )
          : one(
              preferenceSchema,
              'prompter_preference',
              await client.put(`${PREFERENCES_KEY}/${record.id}`, { prompter_preference: { settings } }, record),
            );
      await preferences.mutate([saved], { revalidate: false });
    },
  };
}
