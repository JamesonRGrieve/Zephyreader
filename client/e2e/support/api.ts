// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test';

/** An answer, as the page's own fetch saw it. */
export interface Answer {
  status: () => number;
  headers: () => Record<string, string>;
  json: () => Promise<unknown>;
}

/**
 * Calls the API from inside the page, as the app does: the browser sends the session
 * cookie, and a write echoes the CSRF cookie in X-CSRF-Token.
 */
export async function call(
  page: Page,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<Answer> {
  const answer = await page.evaluate(
    async ({ method, path, body, headers }) => {
      const token = document.cookie.match(/(?:^|; )zx_csrf=([^;]*)/)?.[1];
      const response = await fetch(`/api${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(method !== 'GET' && token !== undefined ? { 'X-CSRF-Token': decodeURIComponent(token) } : {}),
          ...headers,
        },
        ...(body === null ? {} : { body: JSON.stringify(body) }),
      });
      const text = await response.text();
      return { status: response.status, headers: Object.fromEntries(response.headers.entries()), text };
    },
    { method, path, body: body ?? null, headers },
  );
  return {
    status: () => answer.status,
    headers: () => answer.headers,
    json: async () => JSON.parse(answer.text) as unknown,
  };
}

/** A script made for a test, as its person (the record the API answered). */
export async function makeScript(page: Page, title: string, content: string): Promise<{ id: string }> {
  const answer = await call(page, 'POST', '/v1/script', { script: { title, content } });
  const body = (await answer.json()) as { script: { id: string } };
  return body.script;
}
