'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setCookie } from 'cookies-next';
import { ShieldCheck, KeyRound, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AuthRouter(): React.ReactElement {
  const router = useRouter();
  const [jwtValue, setJwtValue] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const authServer = process.env.NEXT_PUBLIC_AUTH_SERVER;
  const oauthUrl = authServer ? `${authServer}/v1/google/login` : null;

  const handleSaveToken = () => {
    if (!jwtValue.trim()) {
      setStatus('Paste a JWT issued by your auth server.');
      return;
    }

    const token = jwtValue.trim().startsWith('Bearer ')
      ? jwtValue.trim()
      : `Bearer ${jwtValue.trim()}`;
    setCookie('jwt', token, { sameSite: 'lax' });
    setStatus('Token saved. Returning to your documents...');
    router.push('/');
  };

  return (
    <div className='grid gap-6 lg:grid-cols-2'>
      <Card className='border-primary/30 shadow-lg'>
        <CardHeader className='space-y-2'>
          <ShieldCheck className='h-8 w-8 text-primary' />
          <CardTitle>Sign in with Google</CardTitle>
          <CardDescription>
            Start the OAuth flow with your configured auth server to receive a JWT for accessing Google Docs.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <p className='text-sm text-muted-foreground'>
            Make sure <code className='rounded bg-muted px-1 py-0.5'>NEXT_PUBLIC_AUTH_SERVER</code> is set. If the
            server exposes a Google login endpoint, you can launch it below.
          </p>
          <Button asChild disabled={!oauthUrl} className='w-full'>
            <a href={oauthUrl ?? '#'} className='flex items-center justify-center gap-2'>
              <ExternalLink className='h-4 w-4' />
              Continue with Google
            </a>
          </Button>
          {!oauthUrl && <p className='text-sm text-destructive'>Set NEXT_PUBLIC_AUTH_SERVER to enable OAuth.</p>}
        </CardContent>
      </Card>

      <Card className='shadow-lg'>
        <CardHeader className='space-y-2'>
          <KeyRound className='h-8 w-8 text-primary' />
          <CardTitle>Paste an existing JWT</CardTitle>
          <CardDescription>
            If you already have a token, paste it here and we will store it in a secure cookie for API requests.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='jwt'>JWT</Label>
            <Input
              id='jwt'
              name='jwt'
              value={jwtValue}
              onChange={(event) => setJwtValue(event.target.value)}
              placeholder='Bearer eyJhbGciOi...'
              autoComplete='off'
            />
          </div>
          <Button className='w-full' onClick={handleSaveToken}>
            Save Token
          </Button>
          {status && <p className='text-sm text-muted-foreground'>{status}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
