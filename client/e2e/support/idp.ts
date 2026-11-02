// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * A real OpenID Connect provider for the end-to-end suite, standing in for Google for
 * both back ends (lite's GOOGLE_ISSUER, the SaaS server's Google instance's issuer).
 * People sign in through its authorize page in the browser, as they would at Google:
 * the suite never injects a session. It serves discovery, JWKS, an authorize page (an
 * email field and a button), and a token endpoint that enforces single-use codes, the
 * client's credentials, the redirect URI and PKCE (S256), and signs RS256 ID tokens.
 *
 *   node e2e/support/idp.ts <port>
 */
import { createHash, randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

export const IDP_CLIENT_ID = 'zephyreader-e2e';
export const IDP_CLIENT_SECRET = 'zephyreader-e2e-secret';
const KEY_ID = 'e2e-key';
const ACCESS_TOKEN_TTL_SECONDS = 3600;
const GRANTED_SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.readonly';

interface Grant {
  email: string;
  nonce: string;
  challenge: string;
  redirectUri: string;
}

const port = Number(process.argv[2] ?? '47100');
const issuer = `http://127.0.0.1:${port}`;
const { publicKey, privateKey } = await generateKeyPair('RS256');
const jwk = { ...(await exportJWK(publicKey)), kid: KEY_ID, alg: 'RS256', use: 'sig' };
const grants = new Map<string, Grant>();
const refreshTokens = new Map<string, string>();
const accessTokens = new Map<string, string>();

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

async function readForm(req: IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

function subjectOf(email: string): string {
  return createHash('sha256').update(email).digest('hex').slice(0, 24);
}

async function tokens(email: string, nonce: string | null): Promise<Record<string, unknown>> {
  const local = email.split('@')[0];
  const idToken = await new SignJWT({
    email,
    email_verified: true,
    name: local,
    given_name: local,
    ...(nonce === null ? {} : { nonce }),
  })
    .setProtectedHeader({ alg: 'RS256', kid: KEY_ID })
    .setIssuer(issuer)
    .setAudience(IDP_CLIENT_ID)
    .setSubject(subjectOf(email))
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(privateKey);
  const refresh = randomBytes(16).toString('hex');
  refreshTokens.set(refresh, email);
  const access = `access-${randomBytes(12).toString('hex')}`;
  accessTokens.set(access, email);
  return {
    access_token: access,
    refresh_token: refresh,
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    id_token: idToken,
    token_type: 'Bearer',
    scope: GRANTED_SCOPES,
  };
}

const server = createServer((req, res) => {
  void (async () => {
    const url = new URL(req.url ?? '/', issuer);
    if (url.pathname === '/.well-known/openid-configuration') {
      json(res, 200, {
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        jwks_uri: `${issuer}/jwks`,
        userinfo_endpoint: `${issuer}/userinfo`,
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        code_challenge_methods_supported: ['S256'],
        scopes_supported: GRANTED_SCOPES.split(' '),
        claims_supported: ['sub', 'email', 'email_verified', 'name'],
      });
      return;
    }
    if (url.pathname === '/jwks') {
      json(res, 200, { keys: [jwk] });
      return;
    }
    if (url.pathname === '/authorize' && req.method === 'GET') {
      const fields = ['client_id', 'redirect_uri', 'state', 'nonce', 'code_challenge', 'code_challenge_method', 'scope']
        .map((name) => `<input type="hidden" name="${name}" value="${escapeHtml(url.searchParams.get(name) ?? '')}">`)
        .join('');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(
        `<!doctype html><html lang="en"><head><title>Test sign-in</title></head><body><main>
         <h1>Test sign-in</h1><form method="post" action="/authorize">${fields}
         <label>Email <input type="email" name="email" required></label>
         <button type="submit">Continue</button></form></main></body></html>`,
      );
      return;
    }
    if (url.pathname === '/authorize' && req.method === 'POST') {
      const form = await readForm(req);
      if (form.get('client_id') !== IDP_CLIENT_ID || form.get('code_challenge_method') !== 'S256') {
        json(res, 400, { error: 'invalid_request' });
        return;
      }
      const code = randomBytes(16).toString('hex');
      const redirectUri = form.get('redirect_uri') ?? '';
      grants.set(code, {
        email: form.get('email') ?? '',
        nonce: form.get('nonce') ?? '',
        challenge: form.get('code_challenge') ?? '',
        redirectUri,
      });
      const target = new URL(redirectUri);
      target.searchParams.set('code', code);
      target.searchParams.set('state', form.get('state') ?? '');
      res.writeHead(303, { Location: target.toString() }).end();
      return;
    }
    if (url.pathname === '/token' && req.method === 'POST') {
      const form = await readForm(req);
      const basic = (req.headers.authorization ?? '').replace(/^Basic /, '');
      const [basicId, basicSecret] =
        basic === '' ? [] : Buffer.from(basic, 'base64').toString().split(':').map(decodeURIComponent);
      const clientId = form.get('client_id') ?? basicId;
      const clientSecret = form.get('client_secret') ?? basicSecret;
      if (clientId !== IDP_CLIENT_ID || clientSecret !== IDP_CLIENT_SECRET) {
        json(res, 401, { error: 'invalid_client' });
        return;
      }
      if (form.get('grant_type') === 'refresh_token') {
        const email = refreshTokens.get(form.get('refresh_token') ?? '');
        if (email === undefined) json(res, 400, { error: 'invalid_grant' });
        else json(res, 200, await tokens(email, null));
        return;
      }
      const code = form.get('code') ?? '';
      const grant = grants.get(code);
      grants.delete(code);
      const verifier = form.get('code_verifier') ?? '';
      const challenge = createHash('sha256').update(verifier).digest('base64url');
      if (
        grant === undefined ||
        form.get('grant_type') !== 'authorization_code' ||
        form.get('redirect_uri') !== grant.redirectUri ||
        challenge !== grant.challenge
      ) {
        json(res, 400, { error: 'invalid_grant' });
        return;
      }
      json(res, 200, await tokens(grant.email, grant.nonce));
      return;
    }
    if (url.pathname === '/userinfo') {
      const email = accessTokens.get((req.headers.authorization ?? '').replace(/^Bearer /, ''));
      if (email === undefined) json(res, 401, { error: 'invalid_token' });
      else json(res, 200, { sub: subjectOf(email), email, email_verified: true, name: email.split('@')[0] });
      return;
    }
    res.writeHead(404).end();
  })().catch((error: unknown) => {
    console.error(error);
    if (!res.headersSent) json(res, 500, { error: 'server_error' });
  });
});

server.listen(port, '127.0.0.1', () => console.log(`test IdP on ${issuer}`));
