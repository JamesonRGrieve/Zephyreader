// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The three voice-follow engines, behind one interface (operator decision: support all
 * three). Each turns the presenter's speech into newly heard words for the aligner.
 *
 * - `local`: a Whisper model in this browser (private, offline once loaded).
 * - `browser`: the browser's own speech recognition (Chrome sends audio to Google; the
 *   settings say so where the engine is chosen).
 * - `server`: the deployment's own speech recognition (SaaS, server voice feature).
 */
import { csrfHeaders } from '@zephyrex/auth/lib/session';
import type { VoiceEngineName } from '~/features/prompter/settings';
import { ClipRecorder } from './clipRecorder';
import type { WorkerReply, WorkerRequest } from './localModel.worker';

const WHISPER_SAMPLE_RATE = 16_000;

export interface VoiceEngine {
  readonly name: VoiceEngineName;
  start(onWords: (words: string[]) => void, onError: (message: string) => void): Promise<void>;
  stop(): void;
}

export function words(text: string): string[] {
  return text.split(/\s+/).filter((word) => word !== '');
}

/**
 * The Web Speech API's recogniser, as far as these engines use it. TypeScript's DOM
 * library declares its events but not the recogniser itself (still a draft standard).
 */
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  addEventListener(type: 'result', listener: (event: SpeechRecognitionEvent) => void): void;
  addEventListener(type: 'error', listener: (event: SpeechRecognitionErrorEvent) => void): void;
  addEventListener(type: 'end', listener: () => void): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

/** The browser's SpeechRecognition constructor, where it has one. */
function speechRecognition(): SpeechRecognitionConstructor | null {
  const constructor: unknown =
    Reflect.get(globalThis, 'SpeechRecognition') ?? Reflect.get(globalThis, 'webkitSpeechRecognition');
  return typeof constructor === 'function' ? (constructor as SpeechRecognitionConstructor) : null;
}

export function browserEngineAvailable(): boolean {
  return speechRecognition() !== null;
}

/** Interim and final results as newly heard words: each result's words past those already sent. */
export class BrowserSpeechEngine implements VoiceEngine {
  readonly name = 'browser';
  private recognition: SpeechRecognitionLike | null = null;
  private stopped = false;

  constructor(private readonly language: string) {}

  async start(onWords: (words: string[]) => void, onError: (message: string) => void): Promise<void> {
    const Recognition = speechRecognition();
    if (Recognition === null) throw new Error('This browser has no speech recognition; choose another engine');
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = this.language;
    const sent = new Map<number, number>();
    recognition.addEventListener('result', (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const heard = words(event.results[index][0].transcript);
        const already = sent.get(index) ?? 0;
        if (heard.length > already) onWords(heard.slice(already));
        sent.set(index, Math.max(already, heard.length));
      }
    });
    recognition.addEventListener('error', (event) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') onError(`Speech recognition stopped: ${event.error}`);
    });
    // Browsers end a continuous session after a while of silence: keep listening.
    recognition.addEventListener('end', () => {
      if (!this.stopped) recognition.start();
    });
    this.stopped = false;
    recognition.start();
    this.recognition = recognition;
    await Promise.resolve();
  }

  stop(): void {
    this.stopped = true;
    this.recognition?.stop();
    this.recognition = null;
  }
}

/** A clip as 16 kHz mono samples, the rate Whisper listens at. */
async function samples(clip: Blob): Promise<Float32Array> {
  const decoder = new AudioContext();
  try {
    const decoded = await decoder.decodeAudioData(await clip.arrayBuffer());
    const length = Math.ceil(decoded.duration * WHISPER_SAMPLE_RATE);
    const resampler = new OfflineAudioContext(1, Math.max(1, length), WHISPER_SAMPLE_RATE);
    const source = resampler.createBufferSource();
    source.buffer = decoded;
    source.connect(resampler.destination);
    source.start();
    return (await resampler.startRendering()).getChannelData(0);
  } finally {
    void decoder.close();
  }
}

export class LocalModelEngine implements VoiceEngine {
  readonly name = 'local';
  private worker: Worker | null = null;
  private recorder: ClipRecorder | null = null;
  private nextId = 0;

  async start(onWords: (words: string[]) => void, onError: (message: string) => void): Promise<void> {
    const worker = new Worker(new URL('./localModel.worker.ts', import.meta.url), { type: 'module' });
    this.worker = worker;
    await new Promise<void>((resolve, reject) => {
      const loaded = (event: MessageEvent<WorkerReply>): void => {
        worker.removeEventListener('message', loaded);
        if (event.data.kind === 'ready') resolve();
        else reject(new Error("The on-device voice model isn't installed here; choose another engine"));
      };
      worker.addEventListener('message', loaded);
      worker.postMessage({ kind: 'load' } satisfies WorkerRequest);
    });
    worker.addEventListener('message', (event: MessageEvent<WorkerReply>) => {
      if (event.data.kind === 'text') onWords(words(event.data.text));
      if (event.data.kind === 'error') onError(event.data.message);
    });
    this.recorder = new ClipRecorder((clip) => {
      void samples(clip)
        .then((audio) => {
          this.nextId += 1;
          worker.postMessage({ kind: 'transcribe', id: this.nextId, audio } satisfies WorkerRequest, [audio.buffer]);
        })
        .catch(() => onError('A clip could not be decoded'));
    });
    await this.recorder.start();
  }

  stop(): void {
    this.recorder?.stop();
    this.recorder = null;
    this.worker?.terminate();
    this.worker = null;
  }
}

export class ServerSpeechEngine implements VoiceEngine {
  readonly name = 'server';
  private recorder: ClipRecorder | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly language: string,
  ) {}

  async start(onWords: (words: string[]) => void, onError: (message: string) => void): Promise<void> {
    this.recorder = new ClipRecorder((clip) => {
      const query = new URLSearchParams({ language: this.language });
      void fetch(`${this.baseUrl}/v1/teleprompter/transcribe?${query.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': clip.type.split(';')[0], ...csrfHeaders('POST') },
        body: clip,
      })
        .then(async (response) => {
          if (!response.ok) {
            onError(response.status === 402 ? 'Server voice-follow needs a paid plan' : 'Server speech recognition failed');
            return;
          }
          const body: unknown = await response.json();
          const text = typeof body === 'object' && body !== null ? Reflect.get(body, 'text') : null;
          if (typeof text === 'string') onWords(words(text));
        })
        .catch(() => onError('Server speech recognition is unreachable'));
    });
    await this.recorder.start();
  }

  stop(): void {
    this.recorder?.stop();
    this.recorder = null;
  }
}

export function createEngine(name: VoiceEngineName, options: { baseUrl: string; language: string }): VoiceEngine {
  switch (name) {
    case 'browser':
      return new BrowserSpeechEngine(options.language);
    case 'server':
      return new ServerSpeechEngine(options.baseUrl, options.language);
    case 'local':
      return new LocalModelEngine();
  }
}
