// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The microphone as a stream of short, self-contained audio clips. A MediaRecorder's
 * timesliced chunks after the first can't be decoded alone, so each clip is its own
 * recording: stopped after `clipMs` and started again at once.
 */

/** How long one clip is: long enough for a few words, short enough to follow speech. */
export const CLIP_MS = 2500;
/** What a voice clip is recorded as, best first (each one the server accepts: contract.test.ts). */
export const CLIP_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];

export function supportedClipType(isSupported: (type: string) => boolean): string | null {
  return CLIP_TYPES.find((type) => isSupported(type)) ?? null;
}

export class ClipRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(
    private readonly onClip: (clip: Blob) => void,
    private readonly clipMs: number = CLIP_MS,
  ) {}

  async start(): Promise<void> {
    const type = supportedClipType((candidate) => MediaRecorder.isTypeSupported(candidate));
    if (type === null) throw new Error('This browser cannot record audio clips');
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
    this.running = true;
    this.next(type);
  }

  private next(type: string): void {
    if (!this.running || this.stream === null) return;
    const recorder = new MediaRecorder(this.stream, { mimeType: type });
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) this.onClip(event.data);
    });
    recorder.addEventListener('stop', () => this.next(type));
    recorder.start();
    this.recorder = recorder;
    this.timer = setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, this.clipMs);
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    if (this.recorder?.state === 'recording') this.recorder.stop();
    this.recorder = null;
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
  }
}
