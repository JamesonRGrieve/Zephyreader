'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react';
import { toast } from 'zephyrex/hooks/useToast';
import { Button } from 'zephyrex/ui/button';
import { SidebarInset } from 'zephyrex/ui/sidebar';
import DisplaySettingsForm from '~/components/prompter/DisplaySettingsForm';
import ScrollSettingsForm from '~/components/prompter/ScrollSettingsForm';
import { PAID_FEATURES, useCapabilities } from '~/features/capabilities';
import { ACTION_LABELS, DEFAULT_KEYMAP, PROMPTER_ACTIONS } from '~/features/control/actions';
import { usePrompterSettings } from '~/features/data/records';
import type { PrompterSettings } from '~/features/prompter/settings';
import { browserEngineAvailable } from '~/features/voice/engines';

/** How a key reads in the reference table. */
function keyName(key: string): string {
  return key === ' ' ? 'Space' : key.replace(/^Media/, 'Media ').replace(/^Arrow/, 'Arrow ');
}

export default function SettingsPage() {
  const saved = usePrompterSettings();
  const capabilities = useCapabilities();
  // The form: the saved settings until changed here.
  const [edited, setEdited] = useState<PrompterSettings | null>(null);
  const draft = saved.loaded ? (edited ?? saved.settings) : null;
  const setDraft = setEdited;
  const [saving, setSaving] = useState(false);
  const serverVoice = capabilities.plans && capabilities.unlocked(PAID_FEATURES.serverVoice);

  const save = async () => {
    if (draft === null) return;
    setSaving(true);
    try {
      await saved.save(draft);
      toast({ title: 'Settings saved' });
    } catch (error) {
      toast({
        title: "Couldn't save your settings",
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SidebarInset className='min-h-svh'>
      <div className='mx-auto w-full max-w-3xl px-4 py-8'>
        <h1 className='mb-2 text-3xl font-bold'>Prompter settings</h1>
        <p className='text-muted-foreground mb-8'>
          How the prompter opens on every device you use. You can change them while presenting too.
        </p>
        {draft === null ? (
          <p className='text-muted-foreground'>Loading your settings…</p>
        ) : (
          <div className='flex flex-col gap-10'>
            <section aria-labelledby='display-heading' className='flex flex-col gap-4'>
              <h2 id='display-heading' className='text-xl font-semibold'>
                Display
              </h2>
              <DisplaySettingsForm settings={draft} onChange={setDraft} />
            </section>
            <section aria-labelledby='scrolling-heading' className='flex flex-col gap-4'>
              <h2 id='scrolling-heading' className='text-xl font-semibold'>
                Scrolling
              </h2>
              <ScrollSettingsForm
                settings={draft}
                onChange={setDraft}
                engines={{
                  local: { available: true, note: 'Your voice never leaves this device.' },
                  browser: {
                    available: browserEngineAvailable(),
                    note: 'In Chrome and Edge your voice is sent to the browser maker.',
                  },
                  server: {
                    available: serverVoice,
                    note: capabilities.plans
                      ? serverVoice
                        ? 'Our own speech recognition.'
                        : 'Included in paid plans.'
                      : 'Not offered here.',
                  },
                }}
              />
            </section>
            <div>
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? 'Saving…' : 'Save settings'}
              </Button>
            </div>
            <section aria-labelledby='keys-heading' className='flex flex-col gap-3'>
              <h2 id='keys-heading' className='text-xl font-semibold'>
                Keys, remotes and pedals
              </h2>
              <p className='text-muted-foreground text-sm'>
                Bluetooth page-turners and foot pedals send these keys, so they work as they are. A game controller works
                too: A to start and pause, the D-pad for speed and scrolling, the shoulders to scroll, B and X for cues.
              </p>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='text-left'>
                    <th className='py-2 pr-4 font-medium'>Action</th>
                    <th className='py-2 font-medium'>Keys</th>
                  </tr>
                </thead>
                <tbody className='divide-border divide-y'>
                  {PROMPTER_ACTIONS.map((action) => (
                    <tr key={action}>
                      <td className='py-2 pr-4'>{ACTION_LABELS[action]}</td>
                      <td className='py-2'>
                        {DEFAULT_KEYMAP[action].map((key) => (
                          <kbd
                            key={key}
                            className='bg-muted mr-1 inline-block rounded border px-1.5 py-0.5 font-mono text-xs'
                          >
                            {keyName(key)}
                          </kbd>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </div>
    </SidebarInset>
  );
}
