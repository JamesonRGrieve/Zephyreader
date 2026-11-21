'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
import { FilePlus2, FileUp, Folder as FolderIcon, FolderPlus, MoreHorizontal, Play, Star } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';
import { serverInstant } from 'zephyrex';
import { Button } from 'zephyrex/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from 'zephyrex/ui/dropdown-menu';
import { Input } from 'zephyrex/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'zephyrex/ui/select';
import { formatDay } from '~/lib/dates';
import { readingSeconds } from '~/features/prompter/script';
import { clock } from '~/features/prompter/timing';
import type { Folder, Script } from '~/features/data/records';
import { filterScripts, sortScripts, SORTS, type LibraryFilter, type LibrarySort } from './libraryView';

export interface ScriptLibraryProps {
  scripts: Script[];
  folders: Folder[];
  /**
   * Whether a deleted script can still come back (its Undo notice is up). The first-run state
   * never shows then, so deleting the last script doesn't flash it.
   */
  pending?: boolean;
  /** Whether the back end can import from the user's Google Drive. */
  googleDrive: boolean;
  onCreate: () => void;
  onImportFile: () => void;
  onImportDrive: () => void;
  onToggleStar: (script: Script) => void;
  onDuplicate: (script: Script) => void;
  onMove: (script: Script, folderId: string | null) => void;
  onDelete: (script: Script) => void;
  onCreateFolder: () => void;
  onRenameFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
  /** The presenter's pace, for each script's reading-time estimate. */
  wordsPerMinute: number;
}

const SORT_LABELS: Record<LibrarySort, string> = {
  recent: 'Recently changed',
  title: 'Title',
  length: 'Longest first',
};

function FolderButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type='button'
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-left text-sm md:w-full md:min-w-0 md:shrink md:whitespace-normal ${
        active ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-muted'
      }`}
    >
      {children}
    </button>
  );
}

export default function ScriptLibrary(props: ScriptLibraryProps) {
  const { scripts, folders, googleDrive, wordsPerMinute } = props;
  const router = useRouter();
  const [filter, setFilter] = useState<LibraryFilter>({ kind: 'all' });
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<LibrarySort>('recent');
  const shown = useMemo(() => sortScripts(filterScripts(scripts, filter, search), sort), [scripts, filter, search, sort]);
  const folderName = (id: string | null) => folders.find((folder) => folder.id === id)?.name;

  return (
    <div className='flex flex-col gap-6 md:flex-row'>
      {/* Rows that wrap on a phone, so every folder and New folder stay in sight (a sideways-scrolling
          row hid them past the edge with nothing to say so); a column beside the scripts on a wider screen. */}
      <nav aria-label='Folders' className='flex shrink-0 flex-wrap gap-1 md:w-56 md:flex-col md:flex-nowrap'>
        <FolderButton active={filter.kind === 'all'} onClick={() => setFilter({ kind: 'all' })}>
          All scripts <span className='text-muted-foreground ml-auto text-xs'>{scripts.length}</span>
        </FolderButton>
        <FolderButton active={filter.kind === 'starred'} onClick={() => setFilter({ kind: 'starred' })}>
          <Star className='h-4 w-4' aria-hidden /> Starred
        </FolderButton>
        {folders.map((folder) => (
          <div key={folder.id} className='group flex shrink-0 items-center md:w-full'>
            <FolderButton
              active={filter.kind === 'folder' && filter.folderId === folder.id}
              onClick={() => setFilter({ kind: 'folder', folderId: folder.id })}
            >
              <FolderIcon className='h-4 w-4' aria-hidden /> <span className='truncate'>{folder.name}</span>
            </FolderButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='icon' aria-label={`Folder ${folder.name} actions`}>
                  <MoreHorizontal className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem onSelect={() => props.onRenameFolder(folder)}>Rename</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => props.onDeleteFolder(folder)}>Delete folder</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        <Button variant='ghost' className='shrink-0 justify-start' onClick={props.onCreateFolder}>
          <FolderPlus className='mr-2 h-4 w-4' aria-hidden /> New folder
        </Button>
      </nav>

      <section aria-label='Scripts' className='flex min-w-0 flex-1 flex-col gap-4'>
        <div className='flex flex-wrap items-center gap-2'>
          <Button onClick={props.onCreate}>
            <FilePlus2 className='mr-2 h-4 w-4' aria-hidden /> New script
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='outline'>
                <FileUp className='mr-2 h-4 w-4' aria-hidden /> Import
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={props.onImportFile}>From a file (.txt, .md, .docx, .pdf, .rtf)</DropdownMenuItem>
              {googleDrive && <DropdownMenuItem onSelect={props.onImportDrive}>From Google Docs</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Searching and sorting share a row: their own on a phone, beside the buttons when there is room. */}
          <div className='flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1'>
            <Input
              type='search'
              placeholder='Search scripts'
              aria-label='Search scripts'
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className='min-w-0 flex-1 sm:max-w-xs'
            />
            <Select
              value={sort}
              onValueChange={(value) => setSort(SORTS.find((candidate) => candidate === value) ?? 'recent')}
            >
              <SelectTrigger className='w-44 shrink-0' aria-label='Sort scripts'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {SORT_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {shown.length === 0 ? (
          scripts.length === 0 && props.pending === true ? null : (
            <p className='text-muted-foreground rounded-lg border border-dashed p-8 text-center'>
              {scripts.length === 0 ? 'No scripts yet. Write one or import a document to start.' : 'No scripts match.'}
            </p>
          )
        ) : (
          <ul className='divide-border divide-y rounded-lg border'>
            {shown.map((script) => (
              <li key={script.id} className='group flex items-center gap-3 px-3 py-3'>
                <button
                  type='button'
                  onClick={() => props.onToggleStar(script)}
                  aria-label={script.starred ? `Unstar ${script.title}` : `Star ${script.title}`}
                  aria-pressed={script.starred}
                  className='rounded p-1'
                >
                  {script.starred ? (
                    <Star className='text-primary h-5 w-5 fill-current' aria-hidden />
                  ) : (
                    <Star className='text-muted-foreground h-5 w-5' aria-hidden />
                  )}
                </button>
                <Link href={`/script/${script.id}`} className='min-w-0 flex-1'>
                  <span className='block truncate font-medium'>{script.title}</span>
                  <span className='text-muted-foreground block text-xs'>
                    {script.word_count} words · about {clock(readingSeconds(script.word_count, wordsPerMinute))}
                    {script.script_folder_id !== null && ` · ${folderName(script.script_folder_id) ?? ''}`}
                    {script.updated_at !== null && ` · changed ${formatDay(serverInstant(script.updated_at))}`}
                  </span>
                </Link>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => router.push(`/present/${script.id}`)}
                  aria-label={`Present ${script.title}`}
                >
                  <Play className='h-4 w-4 sm:mr-2' aria-hidden />
                  <span className='hidden sm:inline'>Present</span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    {/* A secondary action: shown on hover or focus with a mouse, always on touch. */}
                    <Button
                      variant='ghost'
                      size='icon'
                      aria-label={`${script.title} actions`}
                      className='transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100 data-[state=open]:opacity-100'
                    >
                      <MoreHorizontal className='h-4 w-4' />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end'>
                    <DropdownMenuItem onSelect={() => router.push(`/script/${script.id}`)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => props.onDuplicate(script)}>Duplicate</DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Move to</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onSelect={() => props.onMove(script, null)}>No folder</DropdownMenuItem>
                        {folders.map((folder) => (
                          <DropdownMenuItem key={folder.id} onSelect={() => props.onMove(script, folder.id)}>
                            {folder.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => props.onDelete(script)} className='text-destructive'>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
