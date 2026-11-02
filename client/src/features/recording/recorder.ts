// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Recording a take in the browser (both variants): the camera, the screen, or the screen
 * with the camera inset in a corner, with the chosen microphone. The prompter is on the
 * presenter's screen, never in the video. The take is a downloadable file; on SaaS plans
 * with cloud recordings it can also be uploaded to the recordings library.
 */

export const RECORDING_SOURCES = ['camera', 'screen', 'screen-camera'] as const;
export type RecordingSource = (typeof RECORDING_SOURCES)[number];

export const RESOLUTIONS = { '720p': { width: 1280, height: 720 }, '1080p': { width: 1920, height: 1080 } } as const;
export type Resolution = keyof typeof RESOLUTIONS;

const VIDEO_TYPES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
const FRAME_RATE = 30;
/** The camera inset over a screen recording: a quarter of the frame's width, inset from the corner. */
const INSET_WIDTH_SHARE = 0.25;
const INSET_MARGIN = 24;

export interface RecordingOptions {
  source: RecordingSource;
  cameraId: string | null;
  microphoneId: string | null;
  resolution: Resolution;
}

export interface Take {
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
}

export function supportedVideoType(isSupported: (type: string) => boolean): string | null {
  return VIDEO_TYPES.find((type) => isSupported(type)) ?? null;
}

/** The file name a take downloads as. */
export function takeFileName(title: string, mimeType: string, at: Date): string {
  const stamp = at.toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const safe =
    title
      .replace(/[^\p{L}\p{N} _-]+/gu, '')
      .trim()
      .replace(/\s+/g, '-') || 'take';
  return `${safe}-${stamp}.${mimeType.startsWith('video/mp4') ? 'mp4' : 'webm'}`;
}

export async function mediaDevices(): Promise<{ cameras: MediaDeviceInfo[]; microphones: MediaDeviceInfo[] }> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return {
    cameras: devices.filter((device) => device.kind === 'videoinput'),
    microphones: devices.filter((device) => device.kind === 'audioinput'),
  };
}

function stopAll(streams: readonly MediaStream[]): void {
  for (const stream of streams) for (const track of stream.getTracks()) track.stop();
}

/** The screen with the camera drawn over its corner, as one video stream. */
function composite(screen: MediaStream, camera: MediaStream, size: { width: number; height: number }) {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('This browser cannot combine the screen and camera');
  const screenVideo = Object.assign(document.createElement('video'), { srcObject: screen, muted: true });
  const cameraVideo = Object.assign(document.createElement('video'), { srcObject: camera, muted: true });
  void screenVideo.play();
  void cameraVideo.play();
  let frame = 0;
  const draw = (): void => {
    context.drawImage(screenVideo, 0, 0, size.width, size.height);
    const insetWidth = size.width * INSET_WIDTH_SHARE;
    const ratio = cameraVideo.videoWidth > 0 ? cameraVideo.videoHeight / cameraVideo.videoWidth : 9 / 16;
    const insetHeight = insetWidth * ratio;
    context.drawImage(
      cameraVideo,
      size.width - insetWidth - INSET_MARGIN,
      size.height - insetHeight - INSET_MARGIN,
      insetWidth,
      insetHeight,
    );
    frame = requestAnimationFrame(draw);
  };
  draw();
  return { stream: canvas.captureStream(FRAME_RATE), stop: () => cancelAnimationFrame(frame) };
}

export class TakeRecorder {
  private recorder: MediaRecorder | null = null;
  private sources: MediaStream[] = [];
  private stopDrawing: (() => void) | null = null;
  private startedAt = 0;
  /** The camera (or screen) being recorded, for a preview. */
  preview: MediaStream | null = null;

  async start(options: RecordingOptions): Promise<void> {
    const mimeType = supportedVideoType((type) => MediaRecorder.isTypeSupported(type));
    if (mimeType === null) throw new Error('This browser cannot record video');
    const size = RESOLUTIONS[options.resolution];
    const microphone = await navigator.mediaDevices.getUserMedia({
      audio: options.microphoneId === null ? true : { deviceId: { exact: options.microphoneId } },
    });
    this.sources.push(microphone);
    let video: MediaStream;
    try {
      const camera =
        options.source === 'screen'
          ? null
          : await navigator.mediaDevices.getUserMedia({
              video: { ...size, ...(options.cameraId === null ? {} : { deviceId: { exact: options.cameraId } }) },
            });
      const screen =
        options.source === 'camera'
          ? null
          : await navigator.mediaDevices.getDisplayMedia({ video: { ...size, frameRate: FRAME_RATE } });
      for (const stream of [camera, screen]) if (stream !== null) this.sources.push(stream);
      if (screen !== null && camera !== null) {
        const combined = composite(screen, camera, size);
        this.stopDrawing = combined.stop;
        video = combined.stream;
      } else {
        video = (screen ?? camera) as MediaStream;
      }
    } catch (error) {
      this.release();
      throw error;
    }
    this.preview = video;
    const recorded = new MediaStream([...video.getVideoTracks(), ...microphone.getAudioTracks()]);
    this.recorder = new MediaRecorder(recorded, { mimeType });
    this.recorder.start();
    this.startedAt = performance.now();
  }

  /** Ends the take and returns it. */
  async stop(): Promise<Take> {
    const recorder = this.recorder;
    if (recorder === null) throw new Error('Nothing is being recorded');
    const chunks: Blob[] = [];
    recorder.addEventListener('dataavailable', (event) => chunks.push(event.data));
    const stopped = new Promise<void>((resolve) => recorder.addEventListener('stop', () => resolve(), { once: true }));
    recorder.stop();
    await stopped;
    const take = {
      blob: new Blob(chunks, { type: recorder.mimeType }),
      mimeType: recorder.mimeType,
      durationSeconds: (performance.now() - this.startedAt) / 1000,
    };
    this.release();
    return take;
  }

  release(): void {
    this.stopDrawing?.();
    this.stopDrawing = null;
    stopAll(this.sources);
    this.sources = [];
    this.recorder = null;
    this.preview = null;
  }
}
