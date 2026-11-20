'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
import { Captions, Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { serverInstant, useClient } from 'zephyrex';
import { useHidden, useWrites } from 'zephyrex/hooks/useWrites';
import { Button } from 'zephyrex/ui/button';
import { PAID_FEATURES, type Capabilities } from '~/features/capabilities';
import { RECORDINGS_KEY, type Recording } from '~/features/data/records';
import { clock } from '~/features/prompter/timing';

const BYTES_PER_MEGABYTE = 1024 * 1024;
/** Stable across renders, so useHidden can keep the shown list between them. */
const takeId = (recording: Recording): string => recording.id;

export interface RecordingsLibraryProps {
  recordings: Recording[];
  capabilities: Capabilities;
  onChanged: () => Promise<unknown>;
}

/** The takes kept in the cloud: watch them, caption them, download or delete them. */
export default function RecordingsLibrary({ recordings, capabilities, onChanged }: RecordingsLibraryProps) {
  const client = useClient();
  const [captioning, setCaptioning] = useState<string | null>(null);
  const writes = useWrites(onChanged);
  /** Takes deleted on screen whose deletion can still be taken back. */
  const takes = useHidden(recordings, takeId);
  const canCaption = capabilities.unlocked(PAID_FEATURES.captions);
  const { shown } = takes;

  const caption = async (recording: Recording) => {
    setCaptioning(recording.id);
    await writes.run(
      client.post(`${RECORDINGS_KEY}/${recording.id}/captions`, {}),
      "Couldn't caption the take",
      'Captions made',
    );
    setCaptioning(null);
  };

  /** Deletes at once on screen, and on the server once the Undo notice has gone. */
  const remove = (recording: Recording) =>
    writes.remove({
      message: `"${recording.title}" deleted`,
      write: () => client.delete(`${RECORDINGS_KEY}/${recording.id}`, recording),
      fallback: "Couldn't delete the take",
      hide: () => takes.hide([recording.id]),
      show: () => takes.show([recording.id]),
    });

  const problemNotice = writes.problem !== null && (
    <p role='alert' className='text-destructive mb-4 text-sm'>
      {writes.problem}
    </p>
  );

  if (shown.length === 0) {
    return (
      <section aria-label='Your recordings'>
        {problemNotice}
        {/* No first-run state while a deleted take can still come back. */}
        {!takes.pending && (
          <p className='text-muted-foreground rounded-lg border border-dashed p-8 text-center'>
            No recordings yet. Record a take from the prompter.
          </p>
        )}
      </section>
    );
  }

  return (
    <section aria-label='Your recordings'>
      {problemNotice}
      <ul className='grid gap-4 sm:grid-cols-2'>
        {shown.map((recording) => (
          <li key={recording.id} className='flex flex-col gap-3 rounded-lg border p-4'>
            <video
              controls
              preload='metadata'
              className='bg-muted aspect-video w-full rounded-md'
              src={client.url(`${RECORDINGS_KEY}/${recording.id}/content`)}
            >
              {recording.caption_segments !== null && (
                <track
                  kind='captions'
                  label='Captions'
                  default
                  src={client.url(`${RECORDINGS_KEY}/${recording.id}/captions`, { format: 'vtt' })}
                />
              )}
            </video>
            <div>
              <p className='truncate font-medium'>{recording.title}</p>
              <p className='text-muted-foreground text-xs'>
                {recording.duration_seconds !== null && `${clock(recording.duration_seconds)} · `}
                {(recording.size_bytes / BYTES_PER_MEGABYTE).toFixed(1)} MB
                {recording.created_at !== '' && ` · ${serverInstant(recording.created_at).toLocaleDateString()}`}
              </p>
            </div>
            <div className='flex flex-wrap gap-2'>
              <Button asChild size='sm' variant='outline'>
                <a href={client.url(`${RECORDINGS_KEY}/${recording.id}/content`)} download>
                  <Download className='mr-2 h-4 w-4' aria-hidden /> Video
                </a>
              </Button>
              {recording.caption_segments === null ? (
                canCaption && (
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={captioning === recording.id}
                    onClick={() => void caption(recording)}
                  >
                    <Captions className='mr-2 h-4 w-4' aria-hidden />{' '}
                    {captioning === recording.id ? 'Captioning…' : 'Make captions'}
                  </Button>
                )
              ) : (
                <>
                  <Button asChild size='sm' variant='outline'>
                    <a href={client.url(`${RECORDINGS_KEY}/${recording.id}/captions`, { format: 'vtt' })} download>
                      Captions (.vtt)
                    </a>
                  </Button>
                  <Button asChild size='sm' variant='outline'>
                    <a href={client.url(`${RECORDINGS_KEY}/${recording.id}/captions`, { format: 'srt' })} download>
                      Captions (.srt)
                    </a>
                  </Button>
                </>
              )}
              <Button size='sm' variant='ghost' onClick={() => remove(recording)} aria-label={`Delete ${recording.title}`}>
                <Trash2 className='h-4 w-4' aria-hidden />
              </Button>
            </div>
            {recording.transcript !== null && (
              <details>
                <summary className='cursor-pointer text-sm'>Transcript</summary>
                <p className='text-muted-foreground mt-2 whitespace-pre-wrap text-sm'>{recording.transcript}</p>
              </details>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
