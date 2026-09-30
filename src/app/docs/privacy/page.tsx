// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ReactNode } from 'react';
import { PrivacyPage } from 'zephyrex/pages/docs';

/** The app's own policy text; the container image ships src/content beside the server. */
const POLICY_PATH = path.join(process.cwd(), 'src', 'content', 'PRIVACY_POLICY.md');

export default async function Privacy(): Promise<ReactNode> {
  return <PrivacyPage content={await readFile(POLICY_PATH, 'utf8')} />;
}
