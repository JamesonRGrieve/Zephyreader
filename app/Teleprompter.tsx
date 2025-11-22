"use client";

import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(0);
  const [listening, setListening] = useState<boolean>(false);
  const [lastHeard, setLastHeard] = useState<string>('');
  const [micError, setMicError] = useState<string>('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const processedResultsRef = useRef<number>(0);
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

  const normalizeWord = useCallback((word: string) => word.replace(/^[^\w']+|[^\w']+$/g, '').toLowerCase(), []);

  const normalizedWords = useMemo(
    () =>
      (data ?? '')
        .split(/\s+/)
        .map(normalizeWord)
        .filter(Boolean),
    [data, normalizeWord],
  );

  useEffect(() => {
    setCurrentWordIndex(0);
  }, [normalizedWords.length]);

  const advanceWordIndex = useCallback(
    (transcript: string) => {
      setLastHeard(transcript.trim());
      if (!transcript.trim()) return;

      const spokenWords = transcript
        .split(/\s+/)
        .map(normalizeWord)
        .filter(Boolean);

      if (!spokenWords.length || !normalizedWords.length) return;

      setCurrentWordIndex((previous) => {
        let nextIndex = previous;
        spokenWords.forEach((word) => {
          while (nextIndex < normalizedWords.length && normalizedWords[nextIndex] !== word) {
            nextIndex += 1;
          }

          if (nextIndex < normalizedWords.length) {
            nextIndex += 1;
          }
        });

        const lastWordIndex = Math.max(normalizedWords.length - 1, 0);
        return Math.min(nextIndex, lastWordIndex);
      });
    },
    [normalizeWord, normalizedWords],
  );

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setListening(false);
  }, []);

  const handleMicToggle = useCallback(() => {
    if (listening) {
      stopListening();
      return;
    }

    if (typeof window === 'undefined') return;

    const SpeechRecognitionClass =
      window.SpeechRecognition || (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition })
        .webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setMicError('Speech recognition is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      if (!event.results || !event.results.length) return;

      let combinedTranscript = '';
      for (let i = processedResultsRef.current; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          combinedTranscript += `${result[0].transcript} `;
        }
      }
      processedResultsRef.current = event.results.length;

      if (combinedTranscript.trim()) {
        advanceWordIndex(combinedTranscript);
      }
    };

    recognition.onerror = () => {
      setMicError('Microphone error encountered. Please try again.');
      stopListening();
    };

    recognition.onend = () => {
      stopListening();
    };

    processedResultsRef.current = 0;
    recognitionRef.current = recognition as SpeechRecognition;
    setMicError('');
    recognition.start();
    setListening(true);
  }, [advanceWordIndex, listening, stopListening]);

  useEffect(() => stopListening, [stopListening]);

  const renderHighlightedMarkdown = useMemo(() => {
    let wordCounter = 0;

    const processNodes = (children: ReactNode): ReactNode => {
      return React.Children.map(children, (child, index) => {
        if (typeof child === 'string') {
          return child.split(/(\s+)/).map((segment, segmentIndex) => {
            if (!segment.trim()) {
              return segment;
            }

            const normalized = normalizeWord(segment);
            if (!normalized) {
              return segment;
            }

            const isCurrent = wordCounter === currentWordIndex;
            const element = (
              <span
                key={`${index}-${segmentIndex}-${wordCounter}`}
                className={isCurrent ? 'rounded bg-yellow-200 px-1 text-foreground transition-colors' : undefined}
              >
                {segment}
              </span>
            );

            wordCounter += 1;
            return element;
          });
        }

        if (React.isValidElement(child)) {
          return React.cloneElement(child, child.props, processNodes(child.props.children));
        }

        return child;
      });
    };

    const elementComponents = {
      p: ({ children }: { children: ReactNode }) => <p>{processNodes(children)}</p>,
      li: ({ children }: { children: ReactNode }) => <li>{processNodes(children)}</li>,
      h1: ({ children }: { children: ReactNode }) => <h1>{processNodes(children)}</h1>,
      h2: ({ children }: { children: ReactNode }) => <h2>{processNodes(children)}</h2>,
      h3: ({ children }: { children: ReactNode }) => <h3>{processNodes(children)}</h3>,
      h4: ({ children }: { children: ReactNode }) => <h4>{processNodes(children)}</h4>,
      h5: ({ children }: { children: ReactNode }) => <h5>{processNodes(children)}</h5>,
      h6: ({ children }: { children: ReactNode }) => <h6>{processNodes(children)}</h6>,
      strong: ({ children }: { children: ReactNode }) => <strong>{processNodes(children)}</strong>,
      em: ({ children }: { children: ReactNode }) => <em>{processNodes(children)}</em>,
      span: ({ children }: { children: ReactNode }) => <span>{processNodes(children)}</span>,
    };

    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={elementComponents}>
        {data ?? ''}
      </ReactMarkdown>
    );
  }, [currentWordIndex, data, normalizeWord]);

  const activeWord = normalizedWords[currentWordIndex] ?? '';
  const totalWordCount = normalizedWords.length;
  const currentPosition = totalWordCount ? Math.min(currentWordIndex + 1, totalWordCount) : 0;

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
                    {renderHighlightedMarkdown}
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

          <div className='space-y-3 rounded-md border bg-muted/30 p-3'>
            <div className='flex items-center justify-between gap-3'>
              <div>
                <p className='text-sm font-medium'>Mic Mode</p>
                <p className='text-xs text-muted-foreground'>Follow along and highlight the current word.</p>
              </div>
              <Button
                variant={listening ? 'destructive' : 'secondary'}
                size='sm'
                onClick={handleMicToggle}
                className='shrink-0'
              >
                {listening ? 'Stop Mic' : 'Start Mic'}
              </Button>
            </div>

            <p className='text-xs text-muted-foreground'>
              Next word:{' '}
              <span className='font-semibold text-foreground'>{activeWord || 'N/A'}</span>{' '}
              ({currentPosition}/{totalWordCount || 0})
            </p>

            {lastHeard && (
              <p className='text-[11px] text-muted-foreground'>
                Last heard: <span className='font-medium text-foreground'>“{lastHeard.trim()}”</span>
              </p>
            )}

            {micError && <p className='text-[11px] text-destructive'>{micError}</p>}
          </div>

          <div className='rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground'>
            <p>Share this page to let collaborators follow your scroll position in real time.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
