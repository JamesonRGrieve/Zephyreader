'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';
import { AppPage } from '~/components/common/AppPage';
import ScriptEditor from '~/components/editor/ScriptEditor';
import { useCapabilities } from '~/features/capabilities';
import { usePrompterSettings, useRecordActions, useScript } from '~/features/data/records';
import { LIBRARY_PATH } from '~/zephyrex.config';

export default function ScriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const script = useScript(id);
  const capabilities = useCapabilities();
  const { settings } = usePrompterSettings();
  const actions = useRecordActions();

  return (
    <AppPage title='Edit script'>
      <Link
        href={LIBRARY_PATH}
        className='text-muted-foreground mb-4 inline-flex items-center gap-1 text-sm hover:underline'
      >
        <ArrowLeft className='h-4 w-4' aria-hidden /> Your scripts
      </Link>
      <h1 className='sr-only'>Edit script</h1>
      {script.error !== undefined ? (
        <p role='alert' className='text-destructive'>
          This script couldn’t be opened: {script.error.message}
        </p>
      ) : script.data === undefined ? (
        <p className='text-muted-foreground'>Opening the script…</p>
      ) : (
        <ScriptEditor
          script={script.data}
          capabilities={capabilities}
          readingWpm={settings.readingWpm}
          rewrite={actions.rewrite}
          write={async (seen, changes) => {
            const saved = await actions.updateScript(seen, changes);
            await script.mutate(saved, { revalidate: false });
            return saved;
          }}
        />
      )}
    </AppPage>
  );
}
