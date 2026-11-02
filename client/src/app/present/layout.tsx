// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: 'Prompter' };

export default function Layout({ children }: { children: ReactNode }): ReactNode {
  return children;
}
