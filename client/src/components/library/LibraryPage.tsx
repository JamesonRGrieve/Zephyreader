'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { useHidden, useWrites, type Hidden } from 'zephyrex/hooks/useWrites';
import { LoadProblem } from 'zephyrex/ui/load-problem';
import { SkeletonRows } from 'zephyrex/ui/skeleton';
import { LIMITS } from '~/contract';
import NameDialog from '~/components/common/NameDialog';
import { useCapabilities } from '~/features/capabilities';
import {
  useFolders,
  usePrompterSettings,
  useRecordActions,
  useScripts,
  type CloudFile,
  type Folder,
} from '~/features/data/records';
import { IMPORT_ACCEPT, importFile } from '~/features/import/fileImport';
import DriveImportDialog from './DriveImportDialog';
import { copyTitle } from './libraryView';
import ScriptLibrary from './ScriptLibrary';

type Pending = { kind: 'none' } | { kind: 'new-folder' } | { kind: 'rename-folder'; folder: Folder } | { kind: 'drive' };

/** The signed-in home page: the library, and everything done to it. */
export default function LibraryPage() {
  const router = useRouter();
  const capabilities = useCapabilities();
  const scripts = useScripts();
  const folders = useFolders();
  const actions = useRecordActions();
  const { settings } = usePrompterSettings();
  const [pending, setPending] = useState<Pending>({ kind: 'none' });
  /** Records deleted on screen whose deletion can still be taken back. */
  const shownScripts = useHidden(scripts.data ?? [], (script) => script.id);
  const shownFolders = useHidden(folders.data ?? [], (folder) => folder.id);
  const fileInput = useRef<HTMLInputElement>(null);
  const close = () => setPending({ kind: 'none' });

  const refresh = useCallback(async () => {
    await Promise.all([scripts.mutate(), folders.mutate()]);
  }, [scripts, folders]);
  const writes = useWrites(refresh);

  /** Runs a change, then says it was done, or why it wasn't. */
  const run = (action: string, done: string | undefined, work: () => Promise<unknown>): void =>
    void writes.run(work(), `Couldn't ${action}`, done);

  /** Deletes at once on screen, and on the server once the Undo notice has gone. */
  const deleteLater = <T,>(list: Hidden<T>, id: string, message: string, action: string, write: () => Promise<unknown>) =>
    writes.remove({
      message,
      write,
      fallback: `Couldn't ${action}`,
      hide: () => list.hide([id]),
      show: () => list.show([id]),
    });

  const openNew = async (fields: Parameters<typeof actions.createScript>[0]) => {
    const created = await actions.createScript(fields);
    router.push(`/script/${created.id}`);
  };

  const importChosenFile = async (file: File) => {
    const imported = await importFile(file);
    await openNew({ ...imported, source_provider: 'file', source_path: file.name });
  };

  const importFromDrive = async (file: CloudFile) => {
    close();
    const read = await actions.readDrive(file.path);
    await openNew({ title: read.name, content: read.content, source_provider: 'google_drive', source_path: read.path });
  };

  const failedLoad = scripts.error ?? folders.error;
  if (failedLoad !== undefined) {
    return <LoadProblem what='your library' error={failedLoad} onRetry={refresh} />;
  }
  if (scripts.data === undefined || folders.data === undefined) {
    return <SkeletonRows rows={4} label='Loading your scripts…' />;
  }
  const titles = scripts.data.map((script) => script.title);

  return (
    <>
      <ScriptLibrary
        scripts={shownScripts.shown}
        folders={shownFolders.shown}
        pending={shownScripts.pending}
        googleDrive={capabilities.googleDrive}
        wordsPerMinute={settings.speed}
        onCreate={() => run('create a script', undefined, () => openNew({ title: 'Untitled script', content: '' }))}
        onImportFile={() => fileInput.current?.click()}
        onImportDrive={() => setPending({ kind: 'drive' })}
        onToggleStar={(script) =>
          run('star the script', script.starred ? 'Unstarred' : 'Starred', () =>
            actions.updateScript(script, { starred: !script.starred }),
          )
        }
        onDuplicate={(script) =>
          run('duplicate the script', 'Script duplicated', () =>
            actions.createScript({
              title: copyTitle(script.title, titles),
              content: script.content,
              script_folder_id: script.script_folder_id,
            }),
          )
        }
        onMove={(script, folderId) =>
          run('move the script', 'Script moved', () => actions.updateScript(script, { script_folder_id: folderId }))
        }
        onDelete={(script) =>
          deleteLater(shownScripts, script.id, `"${script.title}" deleted`, 'delete the script', () =>
            actions.deleteScript(script),
          )
        }
        onCreateFolder={() => setPending({ kind: 'new-folder' })}
        onRenameFolder={(folder) => setPending({ kind: 'rename-folder', folder })}
        onDeleteFolder={(folder) =>
          deleteLater(shownFolders, folder.id, `Folder "${folder.name}" deleted`, 'delete the folder', () =>
            actions.deleteFolder(folder),
          )
        }
      />
      {writes.problem !== null && (
        <p role='alert' className='text-destructive mt-4 text-sm'>
          {writes.problem}
        </p>
      )}
      <input
        ref={fileInput}
        type='file'
        accept={IMPORT_ACCEPT}
        className='hidden'
        aria-label='Choose a file to import'
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file !== undefined) run('import the file', undefined, () => importChosenFile(file));
        }}
      />
      <NameDialog
        open={pending.kind === 'new-folder' || pending.kind === 'rename-folder'}
        title={pending.kind === 'rename-folder' ? 'Rename folder' : 'New folder'}
        label='Folder name'
        initial={pending.kind === 'rename-folder' ? pending.folder.name : ''}
        confirm={pending.kind === 'rename-folder' ? 'Rename' : 'Create'}
        maxLength={LIMITS.folder_name_characters}
        onClose={close}
        onSubmit={(name) => {
          const target = pending;
          close();
          run(
            target.kind === 'rename-folder' ? 'rename the folder' : 'create the folder',
            target.kind === 'rename-folder' ? 'Folder renamed' : 'Folder created',
            () => (target.kind === 'rename-folder' ? actions.renameFolder(target.folder, name) : actions.createFolder(name)),
          );
        }}
      />
      {capabilities.googleDrive && (
        <DriveImportDialog
          open={pending.kind === 'drive'}
          list={actions.listDrive}
          onClose={close}
          onPick={(file) => run('import from Google Docs', undefined, () => importFromDrive(file))}
        />
      )}
    </>
  );
}
