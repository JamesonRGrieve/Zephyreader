import axios, { AxiosResponse } from 'axios';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';

interface UserInfo {
  email: string;
  given_name: string;
  family_name: string;
}
export interface GoogleDoc {
  id: string;
  name: string;
  starred: boolean;
  modifiedTime: string;
  size: number;
}

export class GoogleOAuth {
  private clientId: string;
  private clientSecret: string;
  private jwtSecret: string;
  private magicLinkUrl: string;

  constructor() {
    this.clientId = process.env.GOOGLE_CLIENT_ID || '';
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    this.jwtSecret = process.env.JWT_SECRET || '';
    this.magicLinkUrl = process.env.AUTH_WEB + '/close/google' || '';
  }

  private async getRefreshToken(
    code: string,
    redirectUri: string,
  ): Promise<{ access_token: string; refresh_token?: string }> {
    const response: AxiosResponse<{ access_token: string; refresh_token?: string }> = await axios.post(
      'https://accounts.google.com/o/oauth2/token',
      {
        code: code.replaceAll('%2F', '/').replaceAll('%3D', '=').replaceAll('%3F', '?').replaceAll('%3D', '='),
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      },
    );

    if (response.status !== 200 || !response.data.access_token) {
      throw new Error("Failed to get authorization_code from Google's OAuth2 API.");
    }

    return response.data;
  }

  private async getUserInfo(accessToken: string): Promise<UserInfo> {
    const response = await axios
      .get('https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .catch((error) => error.response);
    //console.log('Got User Data: ', response.data);
    return {
      given_name: response.data.names[0].givenName,
      family_name: response.data.names[0].familyName,
      email: response.data.emailAddresses[0].value,
    };
  }

  async listUserDocuments(email: string): Promise<GoogleDoc[]> {
    const userTokens = await prisma.user.findFirst({
      where: { email: email },
      select: {
        accessToken: true,
      },
    });

    if (!userTokens?.accessToken) {
      throw new Error('Missing access token for Google user');
    }
    const files = (
      await axios
        .get('https://www.googleapis.com/drive/v3/files', {
          params: {
            q: "mimeType='application/vnd.google-apps.document'",
            fields: 'files(id, name, description, starred, size, modifiedTime)',
          },
          headers: {
            Authorization: `Bearer ${userTokens.accessToken}`,
          },
        })
        .catch((error) => error.response)
    ).data.files;
    for (const file of files) {
      //console.log(file);
    }
    return files;
  }

  async getUserDocumentMarkdown(email: string, documentID: string): Promise<string> {
    const userTokens = await prisma.user.findFirst({
      where: { email: email },
      select: {
        accessToken: true,
      },
    });

    if (!userTokens?.accessToken) {
      throw new Error('Missing access token for Google user');
    }
    const documentBody = (
      await axios
        .get(`https://docs.google.com/feeds/download/documents/export/Export`, {
          params: {
            id: documentID,
            exportFormat: 'markdown',
          },
          headers: {
            Authorization: `Bearer ${userTokens.accessToken}`,
          },
        })
        .catch((error) => error.response)
    )?.data;
    return documentBody;
  }

  private createJWT(userId: string): string {
    return jwt.sign({ sub: userId }, this.jwtSecret, { expiresIn: '1d' });
  }

  private createMagicLink(token: string): string {
    return `${this.magicLinkUrl}?token=${encodeURIComponent(token)}`;
  }

  async callback(code: string, redirectUri: string) {
    const { access_token, refresh_token } = await this.getRefreshToken(code, redirectUri);
    console.log('Got Tokens: ', access_token, refresh_token);
    const userInfo = await this.getUserInfo(access_token);
    const email = userInfo.email.toLowerCase().trim();
    const { id: userID } = await prisma.user.upsert({
      where: { email: email },
      update: {
        accessToken: access_token,
        refreshToken: refresh_token,
        firstName: userInfo.given_name.trim(),
        lastName: userInfo.family_name.trim(),
      },
      create: {
        email: email,
        accessToken: access_token,
        refreshToken: refresh_token,
        firstName: userInfo.given_name.trim(),
        lastName: userInfo.family_name.trim(),
      },
      select: {
        id: true,
      },
    });

    const token = this.createJWT(userID);
    const magic_link = this.createMagicLink(token);

    return {
      magic_link,
      email,
      token,
    };
  }
}
