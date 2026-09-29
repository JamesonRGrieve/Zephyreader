// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { prisma } from '~/lib/prisma';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_PEOPLE_URL = 'https://people.googleapis.com/v1/people/me';
const GOOGLE_DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const GOOGLE_DOCS_EXPORT_URL = 'https://docs.google.com/feeds/download/documents/export/Export';
const GOOGLE_DOC_MIME_TYPE = 'application/vnd.google-apps.document';
const SESSION_TTL = '1d';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
}

interface PeopleResponse {
  names: { givenName?: string; familyName?: string }[];
  emailAddresses: { value: string }[];
}

interface UserInfo {
  email: string;
  givenName: string;
  familyName: string;
}

export interface GoogleDoc {
  id: string;
  name: string;
  starred: boolean;
  modifiedTime: string;
  size: number;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set in environment variables`);
  }
  return value;
}

export class GoogleOAuth {
  private readonly clientId = requireEnv('GOOGLE_CLIENT_ID');
  private readonly clientSecret = requireEnv('GOOGLE_CLIENT_SECRET');
  private readonly jwtSecret = requireEnv('JWT_SECRET');
  private readonly redirectUri = `${requireEnv('AUTH_WEB')}/close/google`;

  private async exchangeCode(code: string): Promise<TokenResponse> {
    const response = await axios.post<TokenResponse>(GOOGLE_TOKEN_URL, {
      code: decodeURIComponent(code),
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });
    return response.data;
  }

  private async getUserInfo(accessToken: string): Promise<UserInfo> {
    const { data } = await axios.get<PeopleResponse>(GOOGLE_PEOPLE_URL, {
      params: { personFields: 'names,emailAddresses' },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const [name] = data.names;
    return {
      givenName: (name?.givenName ?? '').trim(),
      familyName: (name?.familyName ?? '').trim(),
      email: data.emailAddresses[0].value.toLowerCase().trim(),
    };
  }

  private async getAccessToken(email: string): Promise<string> {
    const record = await prisma.user.findUnique({
      where: { email },
      select: { accessToken: true },
    });
    if (!record) {
      throw new Error(`No user found for email ${email}.`);
    }
    return record.accessToken;
  }

  async listUserDocuments(email: string): Promise<GoogleDoc[]> {
    const accessToken = await this.getAccessToken(email);
    const { data } = await axios.get<{ files: GoogleDoc[] }>(GOOGLE_DRIVE_FILES_URL, {
      params: {
        q: `mimeType='${GOOGLE_DOC_MIME_TYPE}'`,
        fields: 'files(id, name, description, starred, size, modifiedTime)',
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data.files;
  }

  async getUserDocumentMarkdown(email: string, documentID: string): Promise<string> {
    const accessToken = await this.getAccessToken(email);
    const { data } = await axios.get<string>(GOOGLE_DOCS_EXPORT_URL, {
      params: { id: documentID, exportFormat: 'markdown' },
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'text',
    });
    return data;
  }

  private createMagicLink(token: string): string {
    return `${this.redirectUri}?token=${encodeURIComponent(token)}`;
  }

  async callback(code: string): Promise<{ magic_link: string; email: string; token: string }> {
    const { access_token: accessToken, refresh_token: refreshToken } = await this.exchangeCode(code);
    const { email, givenName, familyName } = await this.getUserInfo(accessToken);
    const profile = { accessToken, refreshToken, firstName: givenName, lastName: familyName };
    const { id } = await prisma.user.upsert({
      where: { email },
      update: profile,
      create: { email, ...profile },
      select: { id: true },
    });

    const token = jwt.sign({ sub: id }, this.jwtSecret, { expiresIn: SESSION_TTL });
    return { magic_link: this.createMagicLink(token), email, token };
  }
}
