'use client';

import { Button } from '@/components/ui/button';
import { setCookie } from 'cookies-next';
import { ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';

export default function AuthRouter(): React.ReactElement {
  const router = useRouter();
  const [jwtValue, setJwtValue] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const handleSaveToken = () => {
    if (!jwtValue.trim()) {
      setStatus('Paste a JWT issued by your auth server.');
      return;
    }

    const token = jwtValue.trim().startsWith('Bearer ') ? jwtValue.trim() : `Bearer ${jwtValue.trim()}`;
    setCookie('jwt', token, { sameSite: 'lax' });
    setStatus('Token saved. Returning to your documents...');
    router.push('/');
  };

  return (
    <div className='grid gap-6'>
      <Button asChild disabled={!process.env.NEXT_PUBLIC_AUTH_SERVER} className='w-full'>
        <a
          href={`${process.env.NEXT_PUBLIC_AUTH_SERVER}/v1/oauth2/google`}
          className='flex items-center justify-center gap-2'
        >
          <ExternalLink className='h-4 w-4' />
          Continue with Google
        </a>
      </Button>
      <Button asChild disabled={!process.env.NEXT_PUBLIC_AUTH_SERVER} className='w-full'>
        <a
          href={`${process.env.NEXT_PUBLIC_AUTH_SERVER}/v1/oauth2/nextcloud`}
          className='flex items-center justify-center gap-2'
        >
          <ExternalLink className='h-4 w-4' />
          Continue with Nextcloud
        </a>
      </Button>
    </div>
  );
}
