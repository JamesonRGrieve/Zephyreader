'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from 'axios';
import { getCookie } from 'cookies-next/client';
import { useState } from 'react';
import useSWR from 'swr';
import { SidebarInset } from 'zephyrex/ui/sidebar';
import DocumentList from './DocumentList';
import Teleprompter from './Teleprompter';
import type { PrompterDocument } from '~/lib/documents';

export default function Home() {
  const { data: documents, isLoading } = useSWR<PrompterDocument[]>('/documents', async () => {
    return (
      await axios.get(`${process.env.NEXT_PUBLIC_AUTH_SERVER}/google/docs/list`, {
        headers: {
          Authorization: getCookie('jwt') ?? '',
        },
      })
    ).data;
  });

  const [selectedDocument, setSelectedDocument] = useState<PrompterDocument | null>(null);

  return (
    <SidebarInset className='h-svh overflow-y-auto'>
      <div className='container mx-auto px-4 py-8'>
        {!selectedDocument && (
          <>
            <h1 className='mb-8 text-center text-4xl font-bold'>Welcome to OpenTeleprompt</h1>
            {isLoading ? (
              <p className='text-center text-lg'>Loading documents...</p>
            ) : (
              <DocumentList documents={documents ?? []} setSelectedDocument={setSelectedDocument} />
            )}
          </>
        )}
        {selectedDocument && <Teleprompter googleDoc={selectedDocument} setSelectedDocument={setSelectedDocument} />}
      </div>
    </SidebarInset>
  );
}
