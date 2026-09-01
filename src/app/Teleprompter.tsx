'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from 'axios';
import { getCookie } from 'cookies-next/client';
import { EventSourcePolyfill, type MessageEvent as SseMessageEvent } from 'event-source-polyfill';
import { ArrowLeft, ArrowLeftRight, ArrowUpDown, ChevronRight, ChevronsRight, Play, Square } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { v4 as uuidv4 } from 'uuid';
import MarkdownBlock from '@/components/markdown/MarkdownBlock';
import { Button } from 'zephyrex/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'zephyrex/ui/card';
import { Slider } from 'zephyrex/ui/slider';
import type { PrompterDocument } from '~/lib/documents';

export type TeleprompterProps = {
  googleDoc: PrompterDocument;
  setSelectedDocument: (doc: PrompterDocument | null) => void;
};

const HEARTBEAT_INTERVAL_MS = 5000;
const AUTO_SCROLL_TICK_MS = 500;

export default function Teleprompter({ googleDoc, setSelectedDocument }: TeleprompterProps) {
  const eventSourceRef = useRef<EventSourcePolyfill | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const [clientID] = useState<string>(() => uuidv4());
  const [mainWindow, setMainWindow] = useState<boolean>(false);
  const [autoScrolling, setAutoScrolling] = useState<boolean>(false);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState<number>(5);
  const [flipVertical, setFlipVertical] = useState<boolean>(false);
  const [flipHorizontal, setFlipHorizontal] = useState<boolean>(false);
  const playingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleInputScroll = useCallback(() => {
    if (mainWindow && mainRef.current) {
      const scrollPosition = mainRef.current.scrollTop;
      void fetch('/api/v1/scroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: getCookie('jwt') ?? '',
        },
        body: JSON.stringify({ clientID, position: scrollPosition }),
      });
    }
  }, [mainWindow, clientID]);

  useEffect(() => {
    heartbeatIntervalRef.current = setInterval(() => {
      void fetch('/api/v1/scroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: getCookie('jwt') ?? '',
        },
        body: JSON.stringify({ clientID }),
      });
    }, HEARTBEAT_INTERVAL_MS);
    return () => {
      if (heartbeatIntervalRef.current !== null) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [clientID]);

  const handleReceivedScroll = useCallback(
    (event: SseMessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.main) {
        setMainWindow(data.main === clientID);
      } else if (!mainWindow && mainRef.current) {
        mainRef.current.scrollTo(0, Number(data.position));
        if (data.selectedDocument) {
          setSelectedDocument(data.selectedDocument);
        }
      }
    },
    [setSelectedDocument, mainWindow, clientID],
  );

  const handleKillInterval = useCallback(() => {
    if (mainWindow && playingIntervalRef.current !== null) {
      setAutoScrolling(false);
      clearInterval(playingIntervalRef.current);
      playingIntervalRef.current = null;
    }
  }, [mainWindow]);

  const handleInterval = useCallback(() => {
    if (!mainRef.current) return;
    const currentScroll = mainRef.current.scrollTop;
    mainRef.current.scrollTo(0, Number(mainRef.current.scrollTop + autoScrollSpeed));
    if (mainRef.current.scrollTop === currentScroll) {
      handleKillInterval();
    }
  }, [autoScrollSpeed, handleKillInterval]);

  useEffect(() => {
    const main = document.querySelector('main');
    mainRef.current = main;
    main?.addEventListener('scroll', handleInputScroll);

    const source = new EventSourcePolyfill(`/api/v1/scroll?clientID=${clientID}`, {
      headers: {
        Authorization: getCookie('jwt') ?? '',
      },
    });
    eventSourceRef.current = source;
    source.addEventListener('message', handleReceivedScroll);

    return () => {
      main?.removeEventListener('scroll', handleInputScroll);
      source.removeEventListener('message', handleReceivedScroll);
      source.close();
      if (playingIntervalRef.current !== null) {
        clearInterval(playingIntervalRef.current);
        playingIntervalRef.current = null;
      }
    };
  }, [handleInputScroll, handleReceivedScroll, clientID]);

  const { data, isLoading, error } = useSWR(`/docs/${googleDoc.id}`, async () => {
    return googleDoc
      ? (
          await axios.get(`${process.env.NEXT_PUBLIC_AUTH_SERVER}/google/docs?id=${googleDoc.id}`, {
            headers: {
              Authorization: getCookie('jwt') ?? '',
            },
          })
        ).data
      : null;
  });

  return (
    <>
      <div className='container mx-auto px-16'>
        <h1 className='mb-6 flex items-center justify-center text-3xl font-bold'>
          <Button variant='ghost' size='icon' onClick={() => setSelectedDocument(null)} className='mr-2'>
            <ArrowLeft className='h-6 w-6' />
          </Button>
          {googleDoc.name} - {mainWindow ? 'Main Window' : 'Follower Window'}
        </h1>

        {error ? (
          <Card>
            <CardContent>
              <p className='text-base'>Unable to load document from Google, an error occurred.</p>
              <p className='text-destructive text-base'>{error.message}</p>
            </CardContent>
          </Card>
        ) : (
          <div
            style={{
              transform: `scale(${flipHorizontal ? '-1' : '1'}, ${flipVertical ? '-1' : '1'})`,
            }}
          >
            <MarkdownBlock content={isLoading ? 'Loading Document from Google...' : data} />
          </div>
        )}
      </div>

      <Card className='fixed top-24 left-8 w-48'>
        <CardHeader>
          <CardTitle className='text-center text-sm'>Control Panel</CardTitle>
        </CardHeader>
        <CardContent>
          {!mainWindow ? (
            <Button
              onClick={() => {
                void fetch('/api/v1/scroll', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: getCookie('jwt') ?? '',
                  },
                  body: JSON.stringify({ clientID, main: clientID }),
                });
              }}
            >
              Assume Control
            </Button>
          ) : !autoScrolling ? (
            <div className='space-y-4'>
              <div className='flex justify-center space-x-2'>
                <Button
                  variant='outline'
                  size='icon'
                  onClick={() => {
                    if (mainWindow && playingIntervalRef.current === null) {
                      setAutoScrolling(true);
                      playingIntervalRef.current = setInterval(handleInterval, AUTO_SCROLL_TICK_MS);
                    }
                  }}
                >
                  <Play className='h-4 w-4' />
                </Button>
                <Button variant='outline' size='icon' onClick={() => mainWindow && setFlipVertical((old) => !old)}>
                  <ArrowUpDown className={`h-4 w-4 ${flipVertical ? 'text-primary' : ''}`} />
                </Button>
                <Button variant='outline' size='icon' onClick={() => mainWindow && setFlipHorizontal((old) => !old)}>
                  <ArrowLeftRight className={`h-4 w-4 ${flipHorizontal ? 'text-primary' : ''}`} />
                </Button>
              </div>

              <div className='space-y-2'>
                <div className='flex justify-between'>
                  <ChevronRight className='h-4 w-4' />
                  <ChevronsRight className='h-4 w-4' />
                </div>
                <Slider
                  min={5}
                  max={50}
                  step={5}
                  value={[autoScrollSpeed]}
                  onValueChange={(value) => setAutoScrollSpeed(value[0])}
                />
              </div>
            </div>
          ) : (
            <Button variant='outline' size='icon' onClick={handleKillInterval}>
              <Square className='h-4 w-4' />
            </Button>
          )}
        </CardContent>
      </Card>
    </>
  );
}
