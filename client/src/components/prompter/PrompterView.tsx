'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The prompter: the script full-screen, scrolling in the presenter's chosen mode, driven
 * from the keyboard, a page-turner or pedal, media keys, a game controller or the phone
 * remote, mirrored onto any other display the presenter opens, and recorded if asked.
 */
import {
  ArrowLeft,
  ChevronFirst,
  ChevronsLeft,
  ChevronsRight,
  Circle,
  Gauge,
  Maximize,
  Minus,
  MonitorSmartphone,
  Pause,
  PictureInPicture2,
  Play,
  Plus,
  Save,
  SlidersHorizontal,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from 'zephyrex/ui/button';
import { Progress } from 'zephyrex/ui/progress';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from 'zephyrex/ui/sheet';
import { PAID_FEATURES, type Capabilities } from '~/features/capabilities';
import {
  actionForKey,
  asAction,
  DEFAULT_KEYMAP,
  gamepadActions,
  MEDIA_SESSION_ACTIONS,
  PROMPTER_ACTIONS,
  type PrompterAction,
} from '~/features/control/actions';
import type { Script } from '~/features/data/records';
import { prepareScript } from '~/features/prompter/script';
import type { PrompterSettings, VoiceEngineName } from '~/features/prompter/settings';
import { clock } from '~/features/prompter/timing';
import type { Take } from '~/features/recording/recorder';
import { displayShouldLead, LiveChannel, type LiveDevice } from '~/features/sync/liveChannel';
import { VoiceAligner } from '~/features/voice/align';
import { browserEngineAvailable, createEngine } from '~/features/voice/engines';
import DevicesPanel from './DevicesPanel';
import DisplaySettingsForm from './DisplaySettingsForm';
import PrompterSurface from './PrompterSurface';
import RecordPanel from './RecordPanel';
import ScrollSettingsForm from './ScrollSettingsForm';
import { SPEED_STEP, usePrompterScroll } from './usePrompterScroll';

/** How often the leading display tells the others where it is. */
const BROADCAST_INTERVAL_MS = 100;
const STATE_INTERVAL_MS = 500;
const PIP_SIZE = { width: 520, height: 300 };

type Panel = 'display' | 'scrolling' | 'record' | 'devices' | null;

const SETTINGS_NOTE = 'Changes apply at once. Save them as your default from the toolbar.';

/** Each side panel's heading, and the line beneath it that says what it is for. */
const PANELS: Record<NonNullable<Panel>, { title: string; description: string }> = {
  display: { title: 'Display', description: SETTINGS_NOTE },
  scrolling: { title: 'Scrolling', description: SETTINGS_NOTE },
  record: { title: 'Record a take', description: 'The script stays on your screen; it is never in the video.' },
  devices: {
    title: 'Devices and remote',
    description:
      'Open this script on another screen to mirror it, or open the remote on your phone to drive it. One device leads; the others follow.',
  },
};

export interface PrompterViewProps {
  script: Script;
  settings: PrompterSettings;
  savedSettings: PrompterSettings;
  onSettingsChange: (settings: PrompterSettings) => void;
  onSaveDefaults: (settings: PrompterSettings) => Promise<void>;
  capabilities: Capabilities;
  apiBase: string;
  deviceId: string;
  deviceLabel: string;
  upload: (take: Take, title: string) => Promise<void>;
}

/** What a remote sees of the leading display. */
export interface PrompterState {
  playing: boolean;
  mode: PrompterSettings['scrollMode'];
  speed: number;
  progress: number;
  elapsed: number;
  secondsLeft: number | null;
  title: string;
}

interface DocumentPictureInPicture {
  requestWindow(options: { width: number; height: number }): Promise<Window>;
}

function pictureInPicture(): DocumentPictureInPicture | null {
  const api: unknown = Reflect.get(globalThis, 'documentPictureInPicture');
  return typeof api === 'object' && api !== null && 'requestWindow' in api ? (api as DocumentPictureInPicture) : null;
}

function ToolbarButton({
  label,
  onClick,
  children,
  pressed,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  pressed?: boolean;
}) {
  return (
    <Button
      variant='ghost'
      size='icon'
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className='text-inherit hover:bg-white/15'
    >
      {children}
    </Button>
  );
}

export default function PrompterView(props: PrompterViewProps) {
  const { script, settings, capabilities } = props;
  const prepared = useMemo(() => prepareScript(script.content), [script.content]);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [isMain, setIsMain] = useState(true);
  const scroll = usePrompterScroll(surfaceRef, prepared, settings, isMain);
  const [panel, setPanel] = useState<Panel>(null);
  const [devices, setDevices] = useState<LiveDevice[]>([]);
  const [connected, setConnected] = useState(true);
  const [voiceProblem, setVoiceProblem] = useState<string | null>(null);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const pipSurfaceRef = useRef<HTMLDivElement>(null);
  const channel = useRef<LiveChannel | null>(null);
  // Whether the channel names this display the leader, as of its last presence message (not
  // until the first one arrives): a leader never follows another display's position.
  const leadsChannel = useRef(false);
  const aligner = useRef<VoiceAligner | null>(null);
  // The scroll's latest state, for listeners registered once.
  const scrollRef = useRef(scroll);
  useLayoutEffect(() => {
    scrollRef.current = scroll;
  });

  const serverVoice = capabilities.plans && capabilities.unlocked(PAID_FEATURES.serverVoice);
  const engines: Record<VoiceEngineName, { available: boolean; note: string }> = {
    local: { available: true, note: 'Your voice never leaves this device. Needs the voice model installed on this server.' },
    browser: browserEngineAvailable()
      ? { available: true, note: 'In Chrome and Edge your voice is sent to the browser maker to be recognised.' }
      : { available: false, note: 'This browser has none.' },
    server: capabilities.plans
      ? {
          available: serverVoice,
          note: serverVoice ? 'Most accurate; your voice goes to our servers only.' : 'Included in paid plans.',
        }
      : { available: false, note: 'Not offered here.' },
  };

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement === null) void document.documentElement.requestFullscreen().catch(() => undefined);
    else void document.exitFullscreen();
  }, []);

  /** Does `action` here, or asks the leading display to when this one follows. */
  const perform = useCallback(
    (action: PrompterAction) => {
      const current = scrollRef.current;
      if (!isMain && action !== 'fullscreen' && action !== 'mirror') {
        void channel.current?.send('command', { action });
        return;
      }
      switch (action) {
        case 'playPause':
          if (!current.playing) setVoiceProblem(null);
          current.toggle();
          break;
        case 'faster':
          current.setSpeed(current.speed + SPEED_STEP);
          break;
        case 'slower':
          current.setSpeed(current.speed - SPEED_STEP);
          break;
        case 'scrollBack':
          current.nudge(-1);
          break;
        case 'scrollForward':
          current.nudge(1);
          break;
        case 'previousCue':
          current.jumpCue('previous');
          break;
        case 'nextCue':
          current.jumpCue('next');
          break;
        case 'toStart':
          current.toStart();
          break;
        case 'mirror':
          props.onSettingsChange({ ...settings, mirrorHorizontal: !settings.mirrorHorizontal });
          break;
        case 'fullscreen':
          toggleFullscreen();
          break;
      }
    },
    [isMain, props, settings, toggleFullscreen],
  );

  // The latest `perform`, for the live channel's handlers: the channel lives as long as
  // the script and device, not as long as one render's settings.
  const performRef = useRef(perform);
  useLayoutEffect(() => {
    performRef.current = perform;
  });

  // Keyboards, page-turners and pedals.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (panel !== null) return;
      const action = actionForKey(DEFAULT_KEYMAP, event.key, event.target);
      if (action === null) return;
      event.preventDefault();
      perform(action);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [perform, panel]);

  // Game controllers, read each frame while one is connected.
  useEffect(() => {
    let frame = 0;
    let previous: boolean[] = [];
    const poll = () => {
      const pad = navigator.getGamepads().find((candidate) => candidate !== null);
      if (pad !== undefined && pad !== null) {
        const pressed = pad.buttons.map((button) => button.pressed);
        for (const action of gamepadActions(pressed, previous)) perform(action);
        previous = pressed;
      }
      frame = requestAnimationFrame(poll);
    };
    const start = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(poll);
    };
    window.addEventListener('gamepadconnected', start);
    if (navigator.getGamepads().some((pad) => pad !== null)) start();
    return () => {
      window.removeEventListener('gamepadconnected', start);
      cancelAnimationFrame(frame);
    };
  }, [perform]);

  // Media keys and headset buttons.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return undefined;
    const handlers: [MediaSessionAction, () => void][] = [
      ['play', () => perform('playPause')],
      ['pause', () => perform('playPause')],
      ...PROMPTER_ACTIONS.flatMap((action): [MediaSessionAction, () => void][] => {
        const media = MEDIA_SESSION_ACTIONS[action];
        return media === undefined ? [] : [[media, () => perform(action)]];
      }),
    ];
    for (const [media, handler] of handlers) navigator.mediaSession.setActionHandler(media, handler);
    return () => {
      for (const [media] of handlers) navigator.mediaSession.setActionHandler(media, null);
    };
  }, [perform]);

  // Live sync: the displays and remotes on this script.
  useEffect(() => {
    if (!capabilities.liveSync) return undefined;
    const live = new LiveChannel(props.apiBase, `script-${script.id}`, props.deviceId, props.deviceLabel);
    live.open({
      onDevices: (found) => {
        setDevices(found);
        const leads = found.find((device) => device.client_id === props.deviceId)?.main ?? true;
        leadsChannel.current = leads;
        setIsMain(leads);
        if (displayShouldLead(found)) void live.claim();
      },
      onConnection: setConnected,
      onMessage: (message) => {
        const data = typeof message.data === 'object' && message.data !== null ? message.data : {};
        if (message.type === 'scroll') {
          const ratio = Reflect.get(data, 'ratio');
          if (typeof ratio === 'number' && !leadsChannel.current) scrollRef.current.followTo(ratio);
        } else if (message.type === 'command') {
          const action = asAction(Reflect.get(data, 'action'));
          if (action !== null) performRef.current(action);
        }
      },
    });
    channel.current = live;
    return () => {
      live.close();
      channel.current = null;
    };
  }, [capabilities.liveSync, props.apiBase, props.deviceId, props.deviceLabel, script.id]);

  // Who is on the script: when someone joins, the leader says where it is again (below).
  const deviceIds = devices.map((device) => device.client_id).join(',');
  // Leading as the channel says, not as assumed before it has said anything: a display that
  // has only just opened must not broadcast its top-of-script position over the real leader's.
  const leadsOthers = devices.some((device) => device.client_id === props.deviceId && device.main);

  // The leading display tells the others where it is, and remotes what it is doing; again
  // whenever a device joins, so a display opened late is put where the leader already is.
  useEffect(() => {
    if (!leadsOthers || !capabilities.liveSync) return undefined;
    let lastRatio = -1;
    const position = setInterval(() => {
      const ratio = scrollRef.current.ratio();
      if (Math.abs(ratio - lastRatio) > 0.0005) {
        lastRatio = ratio;
        void channel.current?.send('scroll', { ratio });
      }
    }, BROADCAST_INTERVAL_MS);
    const state = setInterval(() => {
      const current = scrollRef.current;
      const shared: PrompterState = {
        playing: current.playing,
        mode: settings.scrollMode,
        speed: current.speed,
        progress: current.progress,
        elapsed: current.elapsed,
        secondsLeft: current.secondsLeft,
        title: script.title,
      };
      void channel.current?.send('state', shared);
    }, STATE_INTERVAL_MS);
    return () => {
      clearInterval(position);
      clearInterval(state);
    };
  }, [leadsOthers, capabilities.liveSync, settings.scrollMode, script.title, deviceIds]);

  // Voice-follow: listen while playing in voice mode on the leading display.
  useEffect(() => {
    if (!scroll.playing || settings.scrollMode !== 'voice' || !isMain) return undefined;
    const follow = new VoiceAligner(prepared.words);
    follow.seek(scrollRef.current.readingWord ?? 0);
    aligner.current = follow;
    const engine = createEngine(settings.voiceEngine, { baseUrl: props.apiBase, language: settings.language });
    engine
      .start(
        (words) => scrollRef.current.voiceAt(follow.hear(words)),
        (message) => setVoiceProblem(message),
      )
      .catch((error: unknown) => {
        setVoiceProblem(error instanceof Error ? error.message : 'Listening could not start');
        scrollRef.current.stop();
      });
    return () => {
      engine.stop();
      aligner.current = null;
    };
  }, [scroll.playing, settings.scrollMode, settings.voiceEngine, settings.language, isMain, prepared.words, props.apiBase]);

  // Keep the screen awake while prompting.
  useEffect(() => {
    if (!scroll.playing || !('wakeLock' in navigator)) return undefined;
    let lock: WakeLockSentinel | null = null;
    void navigator.wakeLock
      .request('screen')
      .then((granted) => {
        lock = granted;
      })
      .catch(() => undefined);
    return () => {
      void lock?.release();
    };
  }, [scroll.playing]);

  // The floating prompter over a video call follows this one.
  useEffect(() => {
    if (pipWindow === null) return undefined;
    let frame = 0;
    const follow = () => {
      const target = pipSurfaceRef.current;
      if (target !== null) target.scrollTop = scrollRef.current.ratio() * (target.scrollHeight - target.clientHeight);
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    const closed = () => setPipWindow(null);
    pipWindow.addEventListener('pagehide', closed);
    return () => {
      cancelAnimationFrame(frame);
      pipWindow.removeEventListener('pagehide', closed);
    };
  }, [pipWindow]);

  const openPip = async () => {
    const api = pictureInPicture();
    if (api === null) return;
    const opened = await api.requestWindow(PIP_SIZE);
    for (const sheet of [...document.styleSheets]) {
      try {
        const style = opened.document.createElement('style');
        style.textContent = [...sheet.cssRules].map((rule) => rule.cssText).join('\n');
        opened.document.head.append(style);
      } catch {
        if (sheet.href !== null) {
          const link = Object.assign(opened.document.createElement('link'), { rel: 'stylesheet', href: sheet.href });
          opened.document.head.append(link);
        }
      }
    }
    opened.document.body.style.margin = '0';
    setPipWindow(opened);
  };

  const changed = JSON.stringify(settings) !== JSON.stringify(props.savedSettings);
  const following = capabilities.liveSync && !isMain;
  const dim = scroll.playing ? 'opacity-30 hover:opacity-100 focus-within:opacity-100' : 'opacity-100';

  return (
    <div className='fixed inset-0 z-50 flex flex-col bg-black text-white'>
      <div className='relative min-h-0 flex-1'>
        <PrompterSurface
          ref={surfaceRef}
          script={prepared}
          settings={settings}
          readingWord={scroll.readingWord}
          onManualScroll={() => {
            scroll.measure();
            aligner.current?.seek(scroll.readingWord ?? 0);
          }}
        />
        {scroll.countdown !== null && (
          <div className='pointer-events-none absolute inset-0 flex items-center justify-center' aria-live='assertive'>
            <span className='text-[20vh] font-bold drop-shadow-lg'>{scroll.countdown}</span>
          </div>
        )}
        {following && (
          <p className='absolute right-4 top-4 rounded bg-black/60 px-3 py-1 text-sm' role='status'>
            Following the leading display
          </p>
        )}
        {voiceProblem !== null && (
          <p className='absolute left-1/2 top-4 -translate-x-1/2 rounded bg-red-900/90 px-4 py-2 text-sm' role='alert'>
            {voiceProblem}
          </p>
        )}
      </div>

      <div
        className={`flex flex-col gap-2 bg-neutral-900/95 px-3 py-2 transition-opacity ${dim}`}
        role='toolbar'
        aria-label='Prompter controls'
      >
        <Progress value={scroll.progress * 100} className='h-1' aria-label='Progress through the script' />
        <div className='flex flex-wrap items-center gap-1'>
          <Button asChild variant='ghost' size='icon' className='text-inherit hover:bg-white/15'>
            <Link href={`/script/${script.id}`} aria-label='Back to the editor'>
              <ArrowLeft className='h-5 w-5' />
            </Link>
          </Button>
          <Button
            onClick={() => perform('playPause')}
            className='min-w-28'
            aria-label={scroll.playing || scroll.countdown !== null ? 'Pause' : 'Start'}
          >
            {scroll.playing || scroll.countdown !== null ? (
              <Pause className='mr-2 h-4 w-4' />
            ) : (
              <Play className='mr-2 h-4 w-4' />
            )}
            {scroll.playing || scroll.countdown !== null ? 'Pause' : 'Start'}
          </Button>
          <ToolbarButton label='Back to the start' onClick={() => perform('toStart')}>
            <ChevronFirst className='h-5 w-5' />
          </ToolbarButton>
          <ToolbarButton label='Previous cue' onClick={() => perform('previousCue')}>
            <ChevronsLeft className='h-5 w-5' />
          </ToolbarButton>
          <ToolbarButton label='Next cue' onClick={() => perform('nextCue')}>
            <ChevronsRight className='h-5 w-5' />
          </ToolbarButton>
          {settings.scrollMode === 'constant' && (
            <span className='flex items-center gap-1' aria-label='Speed'>
              <ToolbarButton label='Slower' onClick={() => perform('slower')}>
                <Minus className='h-4 w-4' />
              </ToolbarButton>
              <span className='flex items-center gap-1 text-sm tabular-nums' title='Words a minute'>
                <Gauge className='h-4 w-4' aria-hidden /> {scroll.speed}
                <span className='sr-only'> words a minute</span>
              </span>
              <ToolbarButton label='Faster' onClick={() => perform('faster')}>
                <Plus className='h-4 w-4' />
              </ToolbarButton>
            </span>
          )}
          <span className='ml-2 text-sm tabular-nums text-neutral-300' aria-live='off'>
            {clock(scroll.elapsed)}
            {scroll.secondsLeft !== null && ` · ${clock(scroll.secondsLeft)} left`}
            {scroll.wordsPerMinute !== null && ` · ${scroll.wordsPerMinute} wpm`}
          </span>
          <span className='ml-auto flex items-center gap-1'>
            {changed && (
              <Button
                variant='ghost'
                className='text-inherit hover:bg-white/15'
                onClick={() => void props.onSaveDefaults(settings)}
              >
                <Save className='mr-2 h-4 w-4' aria-hidden /> Save as my default
              </Button>
            )}
            <ToolbarButton label='Display' onClick={() => setPanel('display')}>
              <SlidersHorizontal className='h-5 w-5' />
            </ToolbarButton>
            <ToolbarButton label='Scrolling' onClick={() => setPanel('scrolling')}>
              <Gauge className='h-5 w-5' />
            </ToolbarButton>
            <ToolbarButton label='Record' onClick={() => setPanel('record')}>
              <Circle className='h-5 w-5 text-red-500' />
            </ToolbarButton>
            {capabilities.liveSync && (
              <ToolbarButton label='Devices and remote' onClick={() => setPanel('devices')}>
                <MonitorSmartphone className='h-5 w-5' />
              </ToolbarButton>
            )}
            {pictureInPicture() !== null && (
              <ToolbarButton label='Float over other windows' onClick={() => void openPip()} pressed={pipWindow !== null}>
                <PictureInPicture2 className='h-5 w-5' />
              </ToolbarButton>
            )}
            <ToolbarButton label='Full screen' onClick={() => perform('fullscreen')}>
              <Maximize className='h-5 w-5' />
            </ToolbarButton>
          </span>
        </div>
      </div>

      <Sheet open={panel !== null} onOpenChange={(open) => !open && setPanel(null)}>
        <SheetContent className='overflow-y-auto'>
          <SheetHeader>
            <SheetTitle>{panel === null ? '' : PANELS[panel].title}</SheetTitle>
            <SheetDescription>{panel === null ? '' : PANELS[panel].description}</SheetDescription>
          </SheetHeader>
          <div className='py-4'>
            {panel === 'display' && <DisplaySettingsForm settings={settings} onChange={props.onSettingsChange} />}
            {panel === 'scrolling' && (
              <ScrollSettingsForm settings={settings} onChange={props.onSettingsChange} engines={engines} />
            )}
            {panel === 'record' && (
              <RecordPanel
                title={script.title}
                canUpload={capabilities.plans && capabilities.unlocked(PAID_FEATURES.cloudRecordings)}
                upload={props.upload}
              />
            )}
            {panel === 'devices' && (
              <DevicesPanel
                devices={devices}
                thisDevice={props.deviceId}
                isMain={isMain}
                connected={connected}
                remoteHref={`/remote?script=${script.id}`}
                onClaim={() => void channel.current?.claim()}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {pipWindow !== null &&
        createPortal(
          <div style={{ width: '100vw', height: '100vh' }}>
            <PrompterSurface
              ref={pipSurfaceRef}
              script={prepared}
              settings={{ ...settings, fontSize: Math.max(20, settings.fontSize / 2) }}
              readingWord={scroll.readingWord}
            />
          </div>,
          pipWindow.document.body,
        )}
    </div>
  );
}
