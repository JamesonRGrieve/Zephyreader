// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The lite variant's teleprompter records: the same resources, fields and rules as the
 * SaaS server's teleprompter extension (server/extensions/teleprompter/BLL_Teleprompter.py).
 * Team sharing is SaaS-only, so lite records carry `team_id: null` and refuse one.
 */
import type { PrompterPreference, Script, ScriptFolder } from '@prisma/client';
import { z } from 'zod';
import { ApiError, recordError } from '~/lib/apiErrors';
import { prisma } from '~/lib/prisma';
import { notFound, type ResourceSpec } from '~/lib/records';
import { spokenWordCount as wordCount } from '~/features/prompter/script';

// The server's limits (BLL_Teleprompter.py), so both variants accept the same records.
export const MAX_TITLE = 300;
export const MAX_FOLDER_NAME = 120;
export const MAX_SCRIPT_CHARACTERS = 1_000_000;
export const MAX_PREFERENCES_BYTES = 16 * 1024;

/**
 * Lite has no teams, so it answers a record shared with one exactly as the SaaS free plan
 * does: 402 naming the feature and the plan that unlocks it.
 */
function refuseTeam(input: { team_id?: string | null }): void {
  if (input.team_id !== null && input.team_id !== undefined) {
    throw new ApiError(402, { feature: 'team_sharing', upgrade_to: ['team'] });
  }
}

const noTeam = z.string().nullish();

const ownership = { team_id: null, team: null, user_id: null, user: null };

const folderCreate = z.object({
  name: z.string().min(1).max(MAX_FOLDER_NAME),
  team_id: noTeam,
  user_id: z.string().nullish(),
});
const folderUpdate = z.object({ name: z.string().min(1).max(MAX_FOLDER_NAME).optional(), team_id: noTeam });

export const scriptFolders: ResourceSpec<ScriptFolder, z.infer<typeof folderCreate>, z.infer<typeof folderUpdate>> = {
  resource: 'script_folder',
  plural: 'script_folders',
  modelName: 'ScriptFolderModel',
  createSchema: folderCreate,
  updateSchema: folderUpdate,
  list: (ownerId) => prisma.scriptFolder.findMany({ where: { createdById: ownerId }, orderBy: { createdAt: 'asc' } }),
  find: (id, ownerId) => prisma.scriptFolder.findFirst({ where: { id, createdById: ownerId } }),
  insert(ownerId, input, stamp) {
    refuseTeam(input);
    return prisma.scriptFolder.create({ data: { createdById: ownerId, name: input.name, updatedAt: stamp } });
  },
  async updateIfCurrent(id, version, input, stamp, userId) {
    refuseTeam(input);
    const { count } = await prisma.scriptFolder.updateMany({
      where: { id, updatedAt: version },
      data: { ...(input.name === undefined ? {} : { name: input.name }), updatedAt: stamp, updatedById: userId },
    });
    return count === 0 ? null : prisma.scriptFolder.findUnique({ where: { id } });
  },
  async remove(id) {
    await prisma.scriptFolder.delete({ where: { id } });
  },
  fields: (row) => ({ ...ownership, name: row.name }),
};

const scriptCreate = z.object({
  title: z.string().min(1).max(MAX_TITLE),
  content: z.string().max(MAX_SCRIPT_CHARACTERS).default(''),
  starred: z.boolean().default(false),
  word_count: z.number().int().optional(),
  script_folder_id: z.string().nullish(),
  source_provider: z.string().nullish(),
  source_path: z.string().nullish(),
  team_id: noTeam,
  user_id: z.string().nullish(),
});
const scriptUpdate = z.object({
  title: z.string().min(1).max(MAX_TITLE).optional(),
  content: z.string().max(MAX_SCRIPT_CHARACTERS).optional(),
  starred: z.boolean().optional(),
  word_count: z.number().int().optional(),
  script_folder_id: z.string().nullish(),
  team_id: noTeam,
});

/** A folder the script is filed in must be the owner's own. */
async function ownFolder(folderId: string | null | undefined, ownerId: string): Promise<void> {
  if (folderId === null || folderId === undefined) return;
  const folder = await prisma.scriptFolder.findFirst({ where: { id: folderId, createdById: ownerId } });
  if (folder === null) throw notFound('ScriptFolderModel');
}

export const scripts: ResourceSpec<Script, z.infer<typeof scriptCreate>, z.infer<typeof scriptUpdate>> = {
  resource: 'script',
  plural: 'scripts',
  modelName: 'ScriptModel',
  createSchema: scriptCreate,
  updateSchema: scriptUpdate,
  list: (ownerId) => prisma.script.findMany({ where: { createdById: ownerId }, orderBy: { createdAt: 'asc' } }),
  find: (id, ownerId) => prisma.script.findFirst({ where: { id, createdById: ownerId } }),
  async insert(ownerId, input, stamp) {
    refuseTeam(input);
    await ownFolder(input.script_folder_id, ownerId);
    // word_count is kept by the server; a value the client sends is replaced.
    return prisma.script.create({
      data: {
        createdById: ownerId,
        title: input.title,
        content: input.content,
        starred: input.starred,
        wordCount: wordCount(input.content),
        scriptFolderId: input.script_folder_id ?? null,
        sourceProvider: input.source_provider ?? null,
        sourcePath: input.source_path ?? null,
        updatedAt: stamp,
      },
    });
  },
  async updateIfCurrent(id, version, input, stamp, userId) {
    refuseTeam(input);
    await ownFolder(input.script_folder_id, userId);
    const { count } = await prisma.script.updateMany({
      where: { id, updatedAt: version },
      data: {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.content === undefined ? {} : { content: input.content, wordCount: wordCount(input.content) }),
        ...(input.starred === undefined ? {} : { starred: input.starred }),
        ...(input.script_folder_id === undefined ? {} : { scriptFolderId: input.script_folder_id }),
        updatedAt: stamp,
        updatedById: userId,
      },
    });
    return count === 0 ? null : prisma.script.findUnique({ where: { id } });
  },
  async remove(id) {
    await prisma.script.delete({ where: { id } });
  },
  fields: (row) => ({
    script_folder_id: row.scriptFolderId,
    script_folder: null,
    ...ownership,
    title: row.title,
    content: row.content,
    starred: row.starred,
    word_count: row.wordCount,
    source_provider: row.sourceProvider,
    source_path: row.sourcePath,
  }),
};

const settings = z.record(z.string(), z.unknown()).refine((value) => JSON.stringify(value).length <= MAX_PREFERENCES_BYTES, {
  message: `Settings may be at most ${MAX_PREFERENCES_BYTES} bytes`,
});
const preferenceCreate = z.object({ settings: settings.default({}) });
const preferenceUpdate = z.object({ settings: settings.optional() });

function parsedSettings(row: PrompterPreference): Record<string, unknown> {
  const value: unknown = JSON.parse(row.settings);
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {};
}

export const prompterPreferences: ResourceSpec<
  PrompterPreference,
  z.infer<typeof preferenceCreate>,
  z.infer<typeof preferenceUpdate>
> = {
  resource: 'prompter_preference',
  plural: 'prompter_preferences',
  modelName: 'PrompterPreferenceModel',
  createSchema: preferenceCreate,
  updateSchema: preferenceUpdate,
  list: (ownerId) => prisma.prompterPreference.findMany({ where: { createdById: ownerId } }),
  find: (id, ownerId) => prisma.prompterPreference.findFirst({ where: { id, createdById: ownerId } }),
  async beforeCreate(ownerId) {
    if ((await prisma.prompterPreference.count({ where: { createdById: ownerId } })) > 0) {
      throw recordError(409, 'You already have prompter settings; update them');
    }
  },
  insert: (ownerId, input, stamp) =>
    prisma.prompterPreference.create({
      data: { createdById: ownerId, settings: JSON.stringify(input.settings), updatedAt: stamp },
    }),
  async updateIfCurrent(id, version, input, stamp, userId) {
    const { count } = await prisma.prompterPreference.updateMany({
      where: { id, updatedAt: version },
      data: {
        ...(input.settings === undefined ? {} : { settings: JSON.stringify(input.settings) }),
        updatedAt: stamp,
        updatedById: userId,
      },
    });
    return count === 0 ? null : prisma.prompterPreference.findUnique({ where: { id } });
  },
  async remove(id) {
    await prisma.prompterPreference.delete({ where: { id } });
  },
  fields: (row) => ({ settings: parsedSettings(row) }),
};
