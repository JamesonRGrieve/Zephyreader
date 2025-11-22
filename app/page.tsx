'use client';
import React, { useState } from 'react';
import axios from 'axios';
import useSWR from 'swr';
import { getCookie } from 'cookies-next';
import DocumentList from './DocumentList';
import Teleprompter from './Teleprompter';

export default function Home() {
  const {
    data: documents,
    isLoading,
    error,
  } = useSWR('/documents', async () => {
    const token = getCookie('jwt');
    const authHeader = typeof token === 'string' ? token : '';
    return (
      await axios.get(`${process.env.NEXT_PUBLIC_AUTH_SERVER}/v1/google/docs/list`, {
        headers: {
          Authorization: authHeader,
        },
      })
    ).data;
  });

  const [selectedDocument, setSelectedDocument] = useState(null);

  return (
    <div className='space-y-8'>
      {!selectedDocument && (
        <div className='space-y-6'>
          <div className='space-y-3 text-center'>
            <p className='text-sm font-medium uppercase tracking-widest text-primary'>Teleprompter Control</p>
            <h1 className='text-3xl font-semibold sm:text-4xl'>Welcome to OpenTeleprompt</h1>
            <p className='text-muted-foreground'>
              Connect to your Google Drive, pick a document, and control the scroll speed with a clean Tailwind
              interface.
            </p>
          </div>
          {error ? (
            <div className='rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive'>
              Failed to load documents: {error.message}
            </div>
          ) : isLoading ? (
            <div className='flex justify-center'>
              <div className='h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent' />
            </div>
          ) : (
            <DocumentList documents={documents ?? []} setSelectedDocument={setSelectedDocument} />
          )}
        </div>
      )}
      {selectedDocument && <Teleprompter googleDoc={selectedDocument} setSelectedDocument={setSelectedDocument} />}
    </div>
  );
}
