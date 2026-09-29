// SPDX-License-Identifier: AGPL-3.0-or-later
import { ApiError } from '~/lib/apiErrors';
import { decryptSecret, encryptSecret } from '~/lib/auth/crypto';
import { googleProvider, requestTokens } from '~/lib/auth/oauth';
import type { DocumentDescriptor } from '~/lib/documents';
import { prisma } from '~/lib/prisma';

const GOOGLE_DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const GOOGLE_DOCS_EXPORT_URL = 'https://docs.google.com/feeds/download/documents/export/Export';
const GOOGLE_DOC_MIME_TYPE = 'application/vnd.google-apps.document';
/** Refresh this long before the stored expiry so a token never lapses mid-request. */
const TOKEN_REFRESH_MARGIN_MS = 60 * 1000;

export interface GoogleDoc extends DocumentDescriptor {
  modifiedTime: string;
  size: number;
}

/** Google Drive access for one user, through their encrypted Google OAuth link. */
export class GoogleDrive {
  constructor(private readonly userId: string) {}

  private async accessToken(): Promise<string> {
    const link = await prisma.oAuthLink.findFirst({ where: { userId: this.userId, provider: 'google' } });
    if (!link?.accessToken) throw new ApiError(403, 'No Google account is linked to this user');

    const expiresSoon = link.tokenExpiresAt !== null && link.tokenExpiresAt.getTime() - Date.now() < TOKEN_REFRESH_MARGIN_MS;
    if (!expiresSoon) return decryptSecret(link.accessToken);
    if (!link.refreshToken) throw new ApiError(401, 'Google authorization has expired; sign in again');

    const refreshed = await requestTokens(googleProvider(), {
      grant_type: 'refresh_token',
      refresh_token: decryptSecret(link.refreshToken),
    });
    await prisma.oAuthLink.update({
      where: { id: link.id },
      data: {
        accessToken: encryptSecret(refreshed.accessToken),
        tokenExpiresAt: refreshed.expiresAt,
        ...(refreshed.refreshToken ? { refreshToken: encryptSecret(refreshed.refreshToken) } : {}),
      },
    });
    return refreshed.accessToken;
  }

  private async get(url: string, params: Record<string, string>): Promise<Response> {
    const response = await fetch(`${url}?${new URLSearchParams(params).toString()}`, {
      headers: { Authorization: `Bearer ${await this.accessToken()}` },
    });
    if (!response.ok) {
      console.warn('Google API request failed (status %d)', response.status);
      throw new ApiError(502, 'Google request failed');
    }
    return response;
  }

  async listDocuments(): Promise<GoogleDoc[]> {
    const response = await this.get(GOOGLE_DRIVE_FILES_URL, {
      q: `mimeType='${GOOGLE_DOC_MIME_TYPE}'`,
      fields: 'files(id, name, description, starred, size, modifiedTime)',
    });
    return ((await response.json()) as { files: GoogleDoc[] }).files;
  }

  async documentMarkdown(documentID: string): Promise<string> {
    const response = await this.get(GOOGLE_DOCS_EXPORT_URL, { id: documentID, exportFormat: 'markdown' });
    return response.text();
  }
}
