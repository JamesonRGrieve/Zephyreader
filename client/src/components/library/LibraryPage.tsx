'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'zephyrex/hooks/useToast';
import ConfirmDialog from '~/components/common/ConfirmDialog';
import NameDialog from '~/components/common/NameDialog';
import { useCapabilities } from '~/features/capabilities';
import {
  useFolders,
  usePrompterSettings,
  useRecordActions,
  useScripts,
  type CloudFile,
  type Folder,
  type Script,
} from '~/features/data/records';
import { IMPORT_ACCEPT, importFile } from '~/features/import/fileImport';
import DriveImportDialog from './DriveImportDialog';
import { copyTitle } from './libraryView';
import ScriptLibrary from './ScriptLibrary';

const MAX_FOLDER_NAME = 120;

type Pending =
  | { kind: 'none' }
  | { kind: 'new-folder' }
  | { kind: 'rename-folder'; folder: Folder }
  | { kind: 'delete-folder'; folder: Folder }
  | { kind: 'delete-script'; script: Script }
  | { kind: 'drive' };

function failure(error: unknown, action: string): void {
  toast({
    title: `Couldn't ${action}`,
    description: error instanceof Error ? error.message : undefined,
    variant: 'destructive',
  });
}

/** The signed-in home page: the library, and everything done to it. */
export default function LibraryPage() {
  const router = useRouter();
  const capabilities = useCapabilities();
  const scripts = useScripts();
  const folders = useFolders();
  const actions = useRecordActions();
  const { settings } = usePrompterSettings();
  const [pending, setPending] = useState<Pending>({ kind: 'none' });
  const fileInput = useRef<HTMLInputElement>(null);
  const close = () => setPending({ kind: 'none' });

  const refresh = useCallback(async () => {
    await Promise.all([scripts.mutate(), folders.mutate()]);
  }, [scripts, folders]);

  const run = (action: string, work: () => Promise<unknown>) => {
    void work()
      .then(refresh)
      .catch((error: unknown) => failure(error, action));
  };

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

  if (scripts.error !== undefined || folders.error !== undefined) {
    return (
      <p role='alert' className='text-destructive'>
        Your library couldn’t be loaded: {(scripts.error ?? folders.error)?.message}
      </p>
    );
  }
  if (scripts.data === undefined || folders.data === undefined) {
    return <p className='text-muted-foreground'>Loading your scripts…</p>;
  }
  const titles = scripts.data.map((script) => script.title);

  return (
    <>
      <ScriptLibrary
        scripts={scripts.data}
        folders={folders.data}
        googleDrive={capabilities.googleDrive}
        wordsPerMinute={settings.speed}
        onCreate={() =>
          void openNew({ title: 'Untitled script', content: '' }).catch((error: unknown) =>
            failure(error, 'create a script'),
          )
        }
        onImportFile={() => fileInput.current?.click()}
        onImportDrive={() => setPending({ kind: 'drive' })}
        onToggleStar={(script) => run('star the script', () => actions.updateScript(script, { starred: !script.starred }))}
        onDuplicate={(script) =>
          run('duplicate the script', () =>
            actions.createScript({
              title: copyTitle(script.title, titles),
              content: script.content,
              script_folder_id: script.script_folder_id,
            }),
          )
        }
        onMove={(script, folderId) =>
          run('move the script', () => actions.updateScript(script, { script_folder_id: folderId }))
        }
        onDelete={(script) => setPending({ kind: 'delete-script', script })}
        onCreateFolder={() => setPending({ kind: 'new-folder' })}
        onRenameFolder={(folder) => setPending({ kind: 'rename-folder', folder })}
        onDeleteFolder={(folder) => setPending({ kind: 'delete-folder', folder })}
      />
      <input
        ref={fileInput}
        type='file'
        accept={IMPORT_ACCEPT}
        className='hidden'
        aria-label='Choose a file to import'
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file !== undefined) void importChosenFile(file).catch((error: unknown) => failure(error, 'import the file'));
        }}
      />
      <NameDialog
        open={pending.kind === 'new-folder' || pending.kind === 'rename-folder'}
        title={pending.kind === 'rename-folder' ? 'Rename folder' : 'New folder'}
        label='Folder name'
        initial={pending.kind === 'rename-folder' ? pending.folder.name : ''}
        confirm={pending.kind === 'rename-folder' ? 'Rename' : 'Create'}
        maxLength={MAX_FOLDER_NAME}
        onClose={close}
        onSubmit={(name) => {
          const target = pending;
          close();
          run(target.kind === 'rename-folder' ? 'rename the folder' : 'create the folder', () =>
            target.kind === 'rename-folder' ? actions.renameFolder(target.folder, name) : actions.createFolder(name),
          );
        }}
      />
      <ConfirmDialog
        open={pending.kind === 'delete-script'}
        title='Delete this script?'
        description={pending.kind === 'delete-script' ? `"${pending.script.title}" will be gone for good.` : ''}
        confirm='Delete'
        onClose={close}
        onConfirm={() => {
          if (pending.kind === 'delete-script') {
            const { script } = pending;
            run('delete the script', () => actions.deleteScript(script));
          }
          close();
        }}
      />
      <ConfirmDialog
        open={pending.kind === 'delete-folder'}
        title='Delete this folder?'
        description='Its scripts stay in your library, outside any folder.'
        confirm='Delete folder'
        onClose={close}
        onConfirm={() => {
          if (pending.kind === 'delete-folder') {
            const { folder } = pending;
            run('delete the folder', () => actions.deleteFolder(folder));
          }
          close();
        }}
      />
      {capabilities.googleDrive && (
        <DriveImportDialog
          open={pending.kind === 'drive'}
          list={actions.listDrive}
          onClose={close}
          onPick={(file) => void importFromDrive(file).catch((error: unknown) => failure(error, 'import from Google Docs'))}
        />
      )}
    </>
  );
}
