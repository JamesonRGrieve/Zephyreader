import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { getCookie } from 'cookies-next';
import useSWR from 'swr';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { EventSourcePolyfill } from 'event-source-polyfill';
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeft, Play, Square, ArrowUpDown, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { DocumentDescriptor } from '@/lib/documents';

export type TeleprompterProps = {
  googleDoc: DocumentDescriptor;
  setSelectedDocument: (doc: DocumentDescriptor | null) => void;
};

export default function Teleprompter({ googleDoc, setSelectedDocument }: TeleprompterProps) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const [clientID] = useState<string>(uuidv4());
  const [mainWindow, setMainWindow] = useState<boolean>(false);
  const [autoScrolling, setAutoScrolling] = useState<boolean>(false);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState<number>(5);
  const [flipVertical, setFlipVertical] = useState<boolean>(false);
  const [flipHorizontal, setFlipHorizontal] = useState<boolean>(false);
  const playingIntervalRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);

  const authHeader = useCallback(() => {
    const token = getCookie('jwt');
    return typeof token === 'string' ? token : '';
  }, []);

  const handleInputScroll = useCallback(() => {
    if (!mainWindow || !mainRef.current) {
      return;
    }
    const scrollPosition = mainRef.current.scrollTop;
    fetch('/api/v1/scroll', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader(),
      },
      body: JSON.stringify({ clientID, position: scrollPosition }),
    });
  }, [authHeader, clientID, mainWindow]);

  useEffect(() => {
    heartbeatIntervalRef.current = window.setInterval(() => {
      fetch('/api/v1/scroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader(),
        },
        body: JSON.stringify({ clientID }),
      });
    }, 5000);

    return () => {
      if (heartbeatIntervalRef.current) {
        window.clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [authHeader, clientID]);

  const handleReceivedScroll = useCallback(
    (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.main) {
        setMainWindow(data.main === clientID);
        return;
      }

      if (!mainWindow && mainRef.current) {
        mainRef.current.scrollTo({ top: Number(data.position) });
        if (data.selectedDocument) {
          setSelectedDocument(data.selectedDocument);
        }
      }
    },
    [clientID, mainWindow, setSelectedDocument],
  );

  const handleKillInterval = useCallback(() => {
    if (playingIntervalRef.current !== null) {
      setAutoScrolling(false);
      window.clearInterval(playingIntervalRef.current);
      playingIntervalRef.current = null;
    }
  }, []);

  const handleInterval = useCallback(() => {
    if (!mainRef.current) return;

    const currentScroll = mainRef.current.scrollTop;
    mainRef.current.scrollTo({ top: currentScroll + autoScrollSpeed, behavior: 'smooth' });
    if (mainRef.current.scrollTop === currentScroll) {
      handleKillInterval();
    }
  }, [autoScrollSpeed, handleKillInterval]);

  useEffect(() => {
    const mainElement = document.querySelector('main');
    if (!mainElement) {
      return undefined;
    }

    mainRef.current = mainElement as HTMLElement;
    mainElement.addEventListener('scroll', handleInputScroll);

    eventSourceRef.current = new EventSourcePolyfill(`/api/v1/scroll?clientID=${clientID}`, {
      headers: {
        Authorization: authHeader(),
      },
    });
    eventSourceRef.current.addEventListener('message', handleReceivedScroll);

    return () => {
      mainElement.removeEventListener('scroll', handleInputScroll);
      if (eventSourceRef.current) {
        eventSourceRef.current.removeEventListener('message', handleReceivedScroll);
        eventSourceRef.current.close();
      }
      handleKillInterval();
    };
  }, [authHeader, clientID, handleInputScroll, handleKillInterval, handleReceivedScroll]);

  const { data, isLoading, error } = useSWR<string | null>(`/docs/${googleDoc.provider}/${googleDoc.id}`, async () => {
    if (!googleDoc) return null;
    const endpoint = googleDoc.provider === 'nextcloud' ? 'nextcloud' : 'google';
    const response = await axios.get(`${process.env.NEXT_PUBLIC_AUTH_SERVER}/v1/${endpoint}/docs?id=${googleDoc.id}`, {
      headers: {
        Authorization: authHeader(),
      },
    });
    return response.data;
  });

  return (
    <div className='grid gap-6 lg:grid-cols-[1fr,320px]'>
      <div className='space-y-4'>
        <div className='flex flex-wrap items-center gap-3'>
          <Button variant='ghost' size='icon' onClick={() => setSelectedDocument(null)}>
            <ArrowLeft className='h-5 w-5' />
            <span className='sr-only'>Back to documents</span>
          </Button>
          <div className='space-y-1'>
            <p className='text-sm font-medium text-muted-foreground'>
              {mainWindow ? 'Main Window' : 'Follower Window'}
            </p>
            <h1 className='text-2xl font-semibold'>{googleDoc.name}</h1>
          </div>
        </div>

        <Card className='overflow-hidden'>
          <CardHeader>
            <CardTitle className='text-lg'>Live document</CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className='rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive'>
                Unable to load document from {googleDoc.provider === 'google' ? 'Google' : 'Nextcloud'}: {error.message}
              </div>
            ) : (
              <div
                className='min-h-[60vh] space-y-4 rounded-lg border bg-card/40 p-6 shadow-inner'
                style={{
                  transform: `scale(${flipHorizontal ? '-1' : '1'}, ${flipVertical ? '-1' : '1'})`,
                }}
              >
                {isLoading ? (
                  <p className='text-muted-foreground'>
                    Loading document from {googleDoc.provider === 'google' ? 'Google' : 'Nextcloud'}...
                  </p>
                ) : (
                  <div className='markdown-body'>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{data ?? ''}</ReactMarkdown>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className='sticky top-28 h-fit self-start shadow-md'>
        <CardHeader>
          <CardTitle className='text-lg text-center'>Control Panel</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          {!mainWindow ? (
            <Button
              className='w-full'
              onClick={() => {
                fetch('/api/v1/scroll', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: authHeader(),
                  },
                  body: JSON.stringify({ clientID, main: clientID }),
                });
              }}
            >
              Assume Control
            </Button>
          ) : !autoScrolling ? (
            <div className='space-y-4'>
              <div className='flex items-center justify-center gap-2'>
                <Button
                  variant='outline'
                  size='icon'
                  onClick={() => {
                    if (playingIntervalRef.current === null) {
                      setAutoScrolling(true);
                      const interval = window.setInterval(handleInterval, 500);
                      playingIntervalRef.current = interval;
                    }
                  }}
                >
                  <Play className='h-4 w-4' />
                </Button>
                <Button variant='outline' size='icon' onClick={() => setFlipVertical((old) => !old)}>
                  <ArrowUpDown className={`h-4 w-4 ${flipVertical ? 'text-primary' : ''}`} />
                </Button>
                <Button variant='outline' size='icon' onClick={() => setFlipHorizontal((old) => !old)}>
                  <ArrowLeftRight className={`h-4 w-4 ${flipHorizontal ? 'text-primary' : ''}`} />
                </Button>
              </div>

              <div className='space-y-2'>
                <div className='flex justify-between text-xs uppercase tracking-wide text-muted-foreground'>
                  <span>Slower</span>
                  <span>Faster</span>
                </div>
                <Slider
                  min={5}
                  max={50}
                  step={5}
                  value={[autoScrollSpeed]}
                  onValueChange={(value) => setAutoScrollSpeed(value[0])}
                />
                <p className='text-xs text-muted-foreground'>Current speed: {autoScrollSpeed}</p>
              </div>
            </div>
          ) : (
            <Button variant='outline' size='icon' className='w-full' onClick={handleKillInterval}>
              <Square className='h-4 w-4' />
            </Button>
          )}

          <div className='rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground'>
            <p>Share this page to let collaborators follow your scroll position in real time.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
