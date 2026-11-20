'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
import { use, useState } from 'react';
import { writeProblem } from 'zephyrex';
import { notify, toast } from 'zephyrex/hooks/useToast';
import { LoadProblem } from 'zephyrex/ui/load-problem';
import PrompterView from '~/components/prompter/PrompterView';
import { useCapabilities } from '~/features/capabilities';
import { usePrompterSettings, useRecordActions, useScript } from '~/features/data/records';
import type { PrompterSettings } from '~/features/prompter/settings';
import { useThisDevice } from '~/features/sync/thisDevice';
import appConfig from '~/zephyrex.config';

export default function PresentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const script = useScript(id);
  const saved = usePrompterSettings();
  const capabilities = useCapabilities();
  const actions = useRecordActions();
  const device = useThisDevice();
  // This session's settings: the saved ones until changed here, saved back only when asked.
  const [edited, setEdited] = useState<PrompterSettings | null>(null);
  const settings = edited ?? saved.settings;

  if (script.error !== undefined) {
    return (
      <main className='p-8'>
        <h1 className='sr-only'>The prompter</h1>
        <LoadProblem what='this script' error={script.error} onRetry={() => script.mutate()} />
      </main>
    );
  }
  if (script.data === undefined || !saved.loaded || device === null) {
    return (
      <main className='flex min-h-svh items-center justify-center bg-black text-white'>
        <p>Getting the prompter ready…</p>
      </main>
    );
  }
  return (
    <main>
      <h1 className='sr-only'>Presenting {script.data.title}</h1>
      <PrompterView
        script={script.data}
        settings={settings}
        savedSettings={saved.settings}
        onSettingsChange={setEdited}
        onSaveDefaults={async (next) => {
          // The prompter fills the screen, so a notice is the one place this can be said.
          const failed = await writeProblem(saved.save(next), "Couldn't save your settings");
          if (failed === null) notify('Saved as your default');
          else toast({ title: "Couldn't save your settings", description: failed, variant: 'destructive' });
        }}
        capabilities={capabilities}
        apiBase={appConfig.server.baseUrl}
        deviceId={device.id}
        deviceLabel={device.label}
        upload={(take, title) => actions.uploadTake(take, title, id)}
      />
    </main>
  );
}
