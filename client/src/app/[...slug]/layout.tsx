// SPDX-License-Identifier: AGPL-3.0-or-later
import { SidebarInset } from 'zephyrex/ui/sidebar';
import type { ReactNode } from 'react';

export default function CatchAllLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarInset>
      <div className='p-4'>{children}</div>
    </SidebarInset>
  );
}
