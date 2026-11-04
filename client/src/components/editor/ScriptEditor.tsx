'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
import { Bold, Download, Highlighter, Italic, MessageSquareText, Play, Smartphone, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { RequireFeature, useDraft, useEditBase, useGuardedSave } from 'zephyrex';
import { Button } from 'zephyrex/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from 'zephyrex/ui/dropdown-menu';
import { Input } from 'zephyrex/ui/input';
import { Label } from 'zephyrex/ui/label';
import { Textarea } from 'zephyrex/ui/textarea';
import { LIMITS } from '~/contract';
import { PAID_FEATURES, type Capabilities } from '~/features/capabilities';
import { scriptSchema, type Script } from '~/features/data/records';
import { readingSeconds, spokenWordCount } from '~/features/prompter/script';
import { clock } from '~/features/prompter/timing';
import AiPanel, { type AiPanelProps } from './AiPanel';
import { exportName, plainText, wrapSelection, type Markup } from './markup';

/** How long typing pauses before the script saves itself. */
export const AUTOSAVE_DELAY_MS = 1500;

export interface ScriptEditorProps {
  script: Script;
  capabilities: Capabilities;
  /** Writes `changes` to the script the user saw (If-Match); answers with the saved script. */
  write: (seen: Script, changes: Partial<Script>) => Promise<Script>;
  rewrite: AiPanelProps['run'];
  /** The presenter's pace, for the reading-time estimate. */
  wordsPerMinute: number;
}

interface Draft {
  title: string;
  content: string;
}

const TOOLS: { markup: Markup; label: string; icon: typeof Bold }[] = [
  { markup: 'bold', label: 'Bold', icon: Bold },
  { markup: 'italic', label: 'Italic', icon: Italic },
  { markup: 'highlight', label: 'Highlight', icon: Highlighter },
  { markup: 'cue', label: 'Cue note (never shown on the prompter)', icon: MessageSquareText },
];

function download(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  link.click();
  URL.revokeObjectURL(url);
}

export default function ScriptEditor({ script, capabilities, write, rewrite, wordsPerMinute }: ScriptEditorProps) {
  const titleId = useId();
  const contentId = useId();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const { base, rebaseOnSave } = useEditBase(script);
  const [draft, setDraft] = useDraft<Script, Draft>(base, (row) => ({ title: row.title, content: row.content }));
  const guarded = useGuardedSave<Script>(write, scriptSchema);
  const [saving, setSaving] = useState(false);
  const [beforeAi, setBeforeAi] = useState<string | null>(null);

  const changes = useMemo<Partial<Script>>(
    () => ({
      ...(draft.title !== base.title ? { title: draft.title } : {}),
      ...(draft.content !== base.content ? { content: draft.content } : {}),
    }),
    [draft, base],
  );
  const dirty = Object.keys(changes).length > 0;
  const valid = draft.title.trim() !== '';

  const conflicted = guarded.conflict !== null;
  const canSave = dirty && valid && !conflicted && !saving;

  // The save to run: always the latest draft against the latest base.
  const saveNow = useRef<() => Promise<void>>(async () => undefined);
  useLayoutEffect(() => {
    saveNow.current = async () => {
      setSaving(true);
      try {
        await rebaseOnSave(guarded.save(base, changes));
      } finally {
        setSaving(false);
      }
    };
  });

  // Saves itself when typing pauses.
  useEffect(() => {
    if (!canSave) return undefined;
    const timer = setTimeout(() => void saveNow.current(), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [changes, canSave]);

  // Saves at once when the tab is hidden or the editor is left, and warns before leaving
  // unsaved work. Registered once; reads the moment's state, so a save never doubles up.
  const leaving = useRef({ canSave, dirty });
  useLayoutEffect(() => {
    leaving.current = { canSave, dirty };
  });
  useEffect(() => {
    const flush = () => {
      if (leaving.current.canSave) void saveNow.current();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!leaving.current.dirty) return;
      flush();
      event.preventDefault();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      flush();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);

  const apply = (markup: Markup) => {
    const element = textarea.current;
    if (element === null) return;
    const edit = wrapSelection(draft.content, element.selectionStart, element.selectionEnd, markup);
    setDraft((current) => ({ ...current, content: edit.text }));
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(edit.selectionStart, edit.selectionEnd);
    });
  };

  const words = spokenWordCount(draft.content);

  return (
    <div className='flex flex-col gap-4 lg:flex-row'>
      <div className='flex min-w-0 flex-1 flex-col gap-3'>
        <div className='flex flex-col gap-1'>
          <Label htmlFor={titleId}>Title</Label>
          <Input
            id={titleId}
            value={draft.title}
            maxLength={LIMITS.title_characters}
            onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            aria-invalid={!valid}
          />
          {!valid && <p className='text-destructive text-sm'>A script needs a title.</p>}
        </div>

        <div className='flex flex-wrap items-center gap-1' role='toolbar' aria-label='Formatting'>
          {TOOLS.map(({ markup, label, icon: Icon }) => (
            <Button
              key={markup}
              variant='outline'
              size='icon'
              onClick={() => apply(markup)}
              aria-label={label}
              title={label}
            >
              <Icon className='h-4 w-4' aria-hidden />
            </Button>
          ))}
          {beforeAi !== null && (
            <Button
              variant='outline'
              onClick={() => {
                setDraft((current) => ({ ...current, content: beforeAi }));
                setBeforeAi(null);
              }}
            >
              <Undo2 className='mr-2 h-4 w-4' aria-hidden /> Undo AI change
            </Button>
          )}
          <span className='text-muted-foreground ml-auto text-sm' aria-live='polite'>
            {words} words · about {clock(readingSeconds(words, wordsPerMinute))} ·{' '}
            {saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved'}
          </span>
        </div>

        {guarded.conflict !== null && (
          <div role='alert' className='border-destructive flex flex-col gap-2 rounded-lg border p-4'>
            <p className='font-medium'>This script was changed somewhere else while you were editing.</p>
            <p className='text-muted-foreground text-sm'>Your changes are kept. Choose which version to keep.</p>
            <div className='flex flex-wrap gap-2'>
              <Button onClick={() => void rebaseOnSave(guarded.resolve(guarded.conflict?.mine ?? {}))}>
                Keep my version
              </Button>
              <Button variant='outline' onClick={guarded.discard}>
                Use the other version
              </Button>
            </div>
          </div>
        )}

        <Label htmlFor={contentId} className='sr-only'>
          Script
        </Label>
        <Textarea
          id={contentId}
          ref={textarea}
          value={draft.content}
          onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
          placeholder={
            'Write your script here.\n\nUse [square brackets] for cue notes that never show on the prompter, and # headings for sections you can jump between.'
          }
          className='min-h-[50vh] font-mono text-base leading-relaxed md:min-h-[calc(100svh-17rem)]'
        />
      </div>

      <aside className='flex flex-col gap-3 lg:w-80' aria-label='Script actions'>
        <Button asChild size='lg'>
          <Link href={`/present/${script.id}`}>
            <Play className='mr-2 h-4 w-4' aria-hidden /> Present
          </Link>
        </Button>
        {capabilities.liveSync && (
          <Button asChild variant='outline'>
            <Link href={`/remote?script=${script.id}`}>
              <Smartphone className='mr-2 h-4 w-4' aria-hidden /> Remote control on this device
            </Link>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='outline'>
              <Download className='mr-2 h-4 w-4' aria-hidden /> Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => download(exportName(draft.title, 'md'), draft.content, 'text/markdown')}>
              Markdown (.md)
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => download(exportName(draft.title, 'txt'), plainText(draft.content), 'text/plain')}
            >
              Plain text (.txt)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {capabilities.plans && (
          <RequireFeature feature={PAID_FEATURES.aiWriter} title='The AI writer'>
            <AiPanel
              content={draft.content}
              run={rewrite}
              onResult={(content) => {
                setBeforeAi(draft.content);
                setDraft((current) => ({ ...current, content }));
              }}
            />
          </RequireFeature>
        )}
      </aside>
    </div>
  );
}
