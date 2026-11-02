'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
import { FileText, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { serverInstant } from 'zephyrex';
import { Button } from 'zephyrex/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from 'zephyrex/ui/dialog';
import { Input } from 'zephyrex/ui/input';
import type { CloudFile } from '~/features/data/records';

/** How long the search waits after the last keystroke before asking Drive. */
const SEARCH_DEBOUNCE_MS = 350;

export interface DriveImportDialogProps {
  open: boolean;
  list: (search: string) => Promise<CloudFile[]>;
  onPick: (file: CloudFile) => void;
  onClose: () => void;
}

/** Picks a Google Doc (or a text/Markdown file) from the user's own Drive. */
export default function DriveImportDialog({ open, list, onPick, onClose }: DriveImportDialogProps) {
  const [search, setSearch] = useState('');
  const [files, setFiles] = useState<CloudFile[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    let current = true;
    const timer = setTimeout(() => {
      setProblem(null);
      list(search)
        .then((found) => current && setFiles(found.filter((file) => !file.is_folder)))
        .catch((error: unknown) => {
          if (!current) return;
          setFiles([]);
          setProblem(error instanceof Error ? error.message : 'Google Drive did not answer');
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [open, search, list]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className='max-w-xl'>
        <DialogHeader>
          <DialogTitle>Import from Google Docs</DialogTitle>
          <DialogDescription>Your Docs and text files, read with your own Google sign-in.</DialogDescription>
        </DialogHeader>
        <Input
          type='search'
          placeholder='Search your Drive'
          aria-label='Search your Drive'
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {problem !== null && (
          <p role='status' className='text-destructive text-sm'>
            {problem}
          </p>
        )}
        <div className='max-h-80 overflow-y-auto'>
          {files === null ? (
            <p className='text-muted-foreground p-4 text-sm'>Loading your files…</p>
          ) : files.length === 0 && problem === null ? (
            <p className='text-muted-foreground p-4 text-sm'>No documents found.</p>
          ) : (
            <ul className='divide-border divide-y'>
              {files.map((file) => (
                <li key={file.path}>
                  <Button
                    variant='ghost'
                    className='h-auto w-full justify-start gap-3 py-3 text-left'
                    onClick={() => onPick(file)}
                  >
                    <FileText className='h-5 w-5 shrink-0' aria-hidden />
                    <span className='min-w-0 flex-1'>
                      <span className='block truncate'>{file.name}</span>
                      {file.modified_at !== null && (
                        <span className='text-muted-foreground block text-xs'>
                          Changed {serverInstant(file.modified_at).toLocaleDateString()}
                        </span>
                      )}
                    </span>
                    {file.starred && <Star className='text-primary h-4 w-4 fill-current' aria-label='Starred' />}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
