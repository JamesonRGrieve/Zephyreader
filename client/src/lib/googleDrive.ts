// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * A user's own Google Drive, for the lite variant's `/v1/cloud/google_drive/*` routes:
 * the same behaviour and answers as server-framework's delegated Google Drive provider
 * (zephyrex/extensions/cloud/PRV_GoogleDrive.py and BLL_Cloud.py). It lists Google Docs,
 * Markdown and text files (and folders), reads a Doc through Drive's Markdown export,
 * and acts only with the signed-in user's own Google token.
 */
import { z } from 'zod';
import { type ApiError, recordError } from '~/lib/apiErrors';
import { decryptSecret, encryptSecret } from '~/lib/auth/crypto';
import { googleProvider, requestTokens } from '~/lib/auth/oauth';
import { prisma } from '~/lib/prisma';

export const PROVIDER = 'google_drive';
const FRIENDLY_NAME = 'Google Drive';
const IDENTITY_PROVIDER = 'google';
export const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
export const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const GOOGLE_DOC_MIME_TYPE = 'application/vnd.google-apps.document';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const TEXT_MIME_TYPES = new Set(['text/plain', 'text/markdown']);
const READABLE_MIME_TYPES = new Set([...TEXT_MIME_TYPES, GOOGLE_DOC_MIME_TYPE]);
const EXPORT_MIME_TYPE = 'text/markdown';
const FILE_FIELDS = 'id,name,mimeType,modifiedTime,starred,size';
const LIST_FIELDS = `nextPageToken,files(${FILE_FIELDS})`;
const PAGE_SIZE = 200;
const FILE_ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;
export const MAX_SEARCH_LENGTH = 200;
/** Refresh this long before the stored expiry so a token never lapses mid-request. */
const TOKEN_REFRESH_MARGIN_MS = 60 * 1000;
const HTTP_TIMEOUT_MS = 30_000;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;

export interface CloudFile {
  path: string;
  name: string;
  mime_type: string | null;
  modified_at: string | null;
  size: number | null;
  starred: boolean;
  is_folder: boolean;
}

export interface CloudFileContent extends CloudFile {
  content: string;
}

/** A Drive `files` entry, validated as it arrives (Google's JSON is untrusted input). */
const driveFileSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  mimeType: z.string().optional(),
  modifiedTime: z.string().optional(),
  starred: z.boolean().optional(),
  size: z.string().optional(),
});
type DriveFile = z.infer<typeof driveFileSchema>;

const drivePageSchema = z.object({
  files: z.array(driveFileSchema).optional(),
  nextPageToken: z.string().optional(),
});

/** Google's answer, or a 502 when it is not the shape Drive documents. */
async function driveJson<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  const parsed = schema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw recordError(502, `${FRIENDLY_NAME} did not answer`);
  return parsed.data;
}

function quoted(value: string): string {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

export function fileId(path: string): string {
  if (!FILE_ID_PATTERN.test(path)) throw recordError(422, `'${path}' is not a Google Drive file id`);
  return path;
}

/** The Drive `q` for readable files (and folders) in `folder`, as the framework builds it. */
export function fileQuery(folder: string, search: string | null): string {
  const kinds = [...READABLE_MIME_TYPES, FOLDER_MIME_TYPE]
    .sort()
    .map((kind) => `mimeType = ${quoted(kind)}`)
    .join(' or ');
  const clauses = [`(${kinds})`, 'trashed = false'];
  if (folder !== '') clauses.push(`${quoted(fileId(folder))} in parents`);
  if (search !== null && search !== '') clauses.push(`name contains ${quoted(search)}`);
  return clauses.join(' and ');
}

export function cloudFile(item: DriveFile): CloudFile {
  const mimeType = item.mimeType ?? null;
  return {
    path: item.id,
    name: item.name ?? '',
    mime_type: mimeType,
    modified_at: item.modifiedTime ?? null,
    size: item.size === undefined ? null : Number(item.size),
    starred: item.starred ?? false,
    is_folder: mimeType === FOLDER_MIME_TYPE,
  };
}

/** The user's current Google access token holding Drive read access (refreshed when it lapses). */
export async function accessToken(userId: string): Promise<string> {
  const links = await prisma.oAuthLink.findMany({
    where: { userId, provider: IDENTITY_PROVIDER },
    orderBy: { updatedAt: 'desc' },
  });
  if (links.length === 0) {
    throw recordError(409, `Sign in with ${IDENTITY_PROVIDER} to reach your ${FRIENDLY_NAME}`);
  }
  const link = links.find((candidate) => (candidate.scopes ?? '').split(' ').includes(DRIVE_READONLY_SCOPE));
  if (link === undefined || link.accessToken === null) {
    throw recordError(403, `Your sign-in does not allow reading your ${FRIENDLY_NAME}; sign in again to allow it`);
  }
  const expiresSoon = link.tokenExpiresAt !== null && link.tokenExpiresAt.getTime() - Date.now() < TOKEN_REFRESH_MARGIN_MS;
  if (!expiresSoon) return decryptSecret(link.accessToken);
  if (link.refreshToken === null) {
    throw recordError(409, 'The access token lapsed and cannot be refreshed');
  }
  const refreshed = await requestTokens(await googleProvider(), {
    grant_type: 'refresh_token',
    refresh_token: decryptSecret(link.refreshToken),
  });
  await prisma.oAuthLink.update({
    where: { id: link.id },
    data: {
      accessToken: encryptSecret(refreshed.accessToken),
      tokenExpiresAt: refreshed.expiresAt,
      ...(refreshed.refreshToken === null ? {} : { refreshToken: encryptSecret(refreshed.refreshToken) }),
    },
  });
  return refreshed.accessToken;
}

/** A Drive refusal as the answer the caller can act on (BLL_Cloud.upstream_refusal). */
function refusal(status: number): ApiError {
  if (status === HTTP_UNAUTHORIZED || status === HTTP_FORBIDDEN) {
    return recordError(403, `${FRIENDLY_NAME} refused your sign-in; sign in again`);
  }
  if (status === HTTP_TOO_MANY_REQUESTS) return recordError(429, `${FRIENDLY_NAME} is rate limiting`);
  console.warn('Google Drive request failed (status %d)', status);
  return recordError(502, `${FRIENDLY_NAME} did not answer`);
}

async function driveGet(token: string, url: string, params: Record<string, string>): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${url}?${new URLSearchParams(params).toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
  } catch {
    throw recordError(502, `${FRIENDLY_NAME} did not answer`);
  }
  if (!response.ok) throw refusal(response.status);
  return response;
}

/** Every page of a listing, from `pageToken` on: each page names the next. */
async function listFrom(token: string, query: string, pageToken: string | undefined): Promise<CloudFile[]> {
  const params: Record<string, string> = {
    q: query,
    fields: LIST_FIELDS,
    orderBy: 'folder,modifiedTime desc',
    pageSize: String(PAGE_SIZE),
    ...(pageToken === undefined ? {} : { pageToken }),
  };
  const page = await driveJson(await driveGet(token, DRIVE_FILES_URL, params), drivePageSchema);
  const files = (page.files ?? []).map(cloudFile);
  return page.nextPageToken === undefined ? files : [...files, ...(await listFrom(token, query, page.nextPageToken))];
}

export async function listFiles(token: string, folder: string, search: string | null): Promise<CloudFile[]> {
  return listFrom(token, fileQuery(folder, search), undefined);
}

export async function readFile(token: string, path: string): Promise<CloudFileContent> {
  const fileUrl = `${DRIVE_FILES_URL}/${fileId(path)}`;
  const described = cloudFile(await driveJson(await driveGet(token, fileUrl, { fields: FILE_FIELDS }), driveFileSchema));
  let response: Response;
  if (described.mime_type === GOOGLE_DOC_MIME_TYPE) {
    response = await driveGet(token, `${fileUrl}/export`, { mimeType: EXPORT_MIME_TYPE });
  } else if (described.mime_type !== null && TEXT_MIME_TYPES.has(described.mime_type)) {
    response = await driveGet(token, fileUrl, { alt: 'media' });
  } else {
    throw recordError(422, `'${described.name}' is not a Google Doc or a text file`);
  }
  return { ...described, content: await response.text() };
}

/** Only Google Drive is a delegated provider here; any other name is the framework's 404. */
export function delegatedProvider(name: string): void {
  if (name !== PROVIDER) throw recordError(404, `No file service named '${name}'`);
}
