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

function isUnauthorized(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 401;
}

export default function Home() {
  const jwt = getCookie('jwt');
  const { data: documents, error, isLoading } = useSWR<PrompterDocument[]>(
    // Only fetch once we hold a token; without one, show the login prompt
    // instead of firing an unauthorized request and rendering an empty list.
    jwt ? '/documents' : null,
    async () => {
      return (
        await axios.get(`${process.env.NEXT_PUBLIC_AUTH_SERVER}/google/docs/list`, {
          headers: {
            Authorization: jwt ?? '',
          },
        })
      ).data;
    },
  );

  const [selectedDocument, setSelectedDocument] = useState<PrompterDocument | null>(null);

  const needsLogin = !jwt || isUnauthorized(error);
  const authUri = process.env.NEXT_PUBLIC_AUTH_URI ?? '/user';

  return (
    <SidebarInset className='h-svh overflow-y-auto'>
      <div className='container mx-auto px-4 py-8'>
        {!selectedDocument && (
          <>
            <h1 className='mb-8 text-center text-4xl font-bold'>Welcome to OpenTeleprompt</h1>
            {needsLogin ? (
              <div className='text-center'>
                <p className='mb-4 text-lg'>Log in to load your documents.</p>
                <a
                  href={authUri}
                  className='inline-block rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90'
                >
                  Log In
                </a>
              </div>
            ) : isLoading ? (
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
