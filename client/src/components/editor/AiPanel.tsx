'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from 'zephyrex/ui/button';
import { Input } from 'zephyrex/ui/input';
import { Label } from 'zephyrex/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'zephyrex/ui/select';
import { Textarea } from 'zephyrex/ui/textarea';

export const AI_ACTIONS = ['write', 'shorten', 'lengthen', 'retone', 'translate'] as const;
export type AiAction = (typeof AI_ACTIONS)[number];

const LABELS: Record<AiAction, string> = {
  write: 'Write from a brief',
  shorten: 'Shorten',
  lengthen: 'Lengthen',
  retone: 'Change the tone',
  translate: 'Translate',
};

export interface AiPanelProps {
  /** The script now, which every action but `write` works on. */
  content: string;
  run: (request: { action: AiAction; content: string; tone?: string; language?: string }) => Promise<string>;
  /** Replaces the script with the result (the editor keeps it undoable as a normal save). */
  onResult: (content: string) => void;
}

/** The script writer: write from a brief, shorten, lengthen, change tone or translate. */
export default function AiPanel({ content, run, onResult }: AiPanelProps) {
  const [action, setAction] = useState<AiAction>('shorten');
  const [brief, setBrief] = useState('');
  const [tone, setTone] = useState('warm and confident');
  const [language, setLanguage] = useState('French');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const source = action === 'write' ? brief : content;

  const go = async () => {
    setBusy(true);
    setProblem(null);
    try {
      onResult(
        await run({
          action,
          content: source,
          ...(action === 'retone' ? { tone } : {}),
          ...(action === 'translate' ? { language } : {}),
        }),
      );
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'The writer did not answer');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label='AI writer' className='flex flex-col gap-3 rounded-lg border p-4'>
      <h2 className='flex items-center gap-2 font-semibold'>
        <Sparkles className='h-4 w-4' aria-hidden /> AI writer
      </h2>
      <Select
        value={action}
        onValueChange={(value) => setAction(AI_ACTIONS.find((candidate) => candidate === value) ?? 'shorten')}
      >
        <SelectTrigger aria-label='What the writer does'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AI_ACTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {LABELS[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {action === 'write' && (
        <div className='flex flex-col gap-1'>
          <Label htmlFor='ai-brief'>Brief</Label>
          <Textarea
            id='ai-brief'
            rows={4}
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            placeholder='A two-minute welcome for our product launch…'
          />
        </div>
      )}
      {action === 'retone' && (
        <div className='flex flex-col gap-1'>
          <Label htmlFor='ai-tone'>Tone</Label>
          <Input id='ai-tone' value={tone} onChange={(event) => setTone(event.target.value)} maxLength={60} />
        </div>
      )}
      {action === 'translate' && (
        <div className='flex flex-col gap-1'>
          <Label htmlFor='ai-language'>Language</Label>
          <Input id='ai-language' value={language} onChange={(event) => setLanguage(event.target.value)} maxLength={60} />
        </div>
      )}
      <Button onClick={() => void go()} disabled={busy || source.trim() === ''}>
        {busy ? 'Writing…' : action === 'write' ? 'Write the script' : `${LABELS[action]} the script`}
      </Button>
      {action !== 'write' && (
        <p className='text-muted-foreground text-xs'>This replaces the script. You can undo it from the editor.</p>
      )}
      {problem !== null && (
        <p role='alert' className='text-destructive text-sm'>
          {problem}
        </p>
      )}
    </section>
  );
}
