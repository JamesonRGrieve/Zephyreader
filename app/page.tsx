'use client';
import React, { useState } from 'react';
import axios from 'axios';
import useSWR from 'swr';
import { getCookie } from 'cookies-next';
import DocumentList from './DocumentList';
import Teleprompter from './Teleprompter';
import { DocumentDescriptor } from '@/lib/documents';

export default function Home() {
  const token = getCookie('jwt');
  const authHeader = typeof token === 'string' ? token : '';

  const {
    data: googleDocs,
    isLoading: loadingGoogle,
    error: googleError,
  } = useSWR('/documents/google', async () => {
    const docs = (
      await axios.get(`${process.env.NEXT_PUBLIC_AUTH_SERVER}/v1/google/docs/list`, {
        headers: {
          Authorization: authHeader,
        },
      })
    ).data as DocumentDescriptor[];
    return docs.map((doc) => ({ ...doc, provider: 'google' as const }));
  });

  const {
    data: nextcloudDocs,
    isLoading: loadingNextcloud,
    error: nextcloudError,
  } = useSWR('/documents/nextcloud', async () => {
    const docs = (
      await axios.get(`${process.env.NEXT_PUBLIC_AUTH_SERVER}/v1/nextcloud/docs/list`, {
        headers: {
          Authorization: authHeader,
        },
      })
    ).data as DocumentDescriptor[];
    return docs.map((doc) => ({ ...doc, provider: 'nextcloud' as const }));
  });

  const [selectedDocument, setSelectedDocument] = useState<DocumentDescriptor | null>(null);

  return (
    <div className='space-y-8'>
      {!selectedDocument && (
        <div className='space-y-6'>
          <div className='space-y-3 text-center'>
            <p className='text-sm font-medium uppercase tracking-widest text-primary'>Teleprompter Control</p>
            <h1 className='text-3xl font-semibold sm:text-4xl'>Welcome to OpenTeleprompt</h1>
            <p className='text-muted-foreground'>
              Connect to your Google Drive or Nextcloud files, pick a document, and control the scroll speed with a
              clean Tailwind interface.
            </p>
          </div>
          <div className='grid gap-4 lg:grid-cols-2'>
            {googleError ? (
              <div className='rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive'>
                Failed to load Google documents: {googleError.message}
              </div>
            ) : loadingGoogle ? (
              <div className='flex justify-center'>
                <div className='h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent' />
              </div>
            ) : (
              <DocumentList
                title='Your Google Docs'
                documents={googleDocs ?? []}
                setSelectedDocument={setSelectedDocument}
              />
            )}

            {nextcloudError ? (
              <div className='rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive'>
                Failed to load Nextcloud documents: {nextcloudError.message}
              </div>
            ) : loadingNextcloud ? (
              <div className='flex justify-center'>
                <div className='h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent' />
              </div>
            ) : (
              <DocumentList
                title='Your Nextcloud Files'
                documents={nextcloudDocs ?? []}
                setSelectedDocument={setSelectedDocument}
              />
            )}
          </div>
        </div>
      )}
      {selectedDocument && <Teleprompter googleDoc={selectedDocument} setSelectedDocument={setSelectedDocument} />}
    </div>
  );
}
