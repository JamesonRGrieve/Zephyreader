'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
import { Circle, CloudUpload, Download, Square } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from 'zephyrex/ui/button';
import { Label } from 'zephyrex/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'zephyrex/ui/select';
import { clock } from '~/features/prompter/timing';
import {
  mediaDevices,
  RECORDING_SOURCES,
  RESOLUTIONS,
  takeFileName,
  TakeRecorder,
  type RecordingSource,
  type Resolution,
  type Take,
} from '~/features/recording/recorder';

const SOURCE_LABELS: Record<RecordingSource, string> = {
  camera: 'Camera',
  screen: 'Screen',
  'screen-camera': 'Screen with camera inset',
};
const DEFAULT_DEVICE = 'default';

export interface RecordPanelProps {
  title: string;
  /** Whether takes can be kept in the cloud library (the plan's cloud recordings). */
  canUpload: boolean;
  upload: (take: Take, title: string) => Promise<void>;
}

export default function RecordPanel({ title, canUpload, upload }: RecordPanelProps) {
  const id = useId();
  const recorder = useRef(new TakeRecorder());
  const preview = useRef<HTMLVideoElement>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [source, setSource] = useState<RecordingSource>('camera');
  const [cameraId, setCameraId] = useState(DEFAULT_DEVICE);
  const [microphoneId, setMicrophoneId] = useState(DEFAULT_DEVICE);
  const [resolution, setResolution] = useState<Resolution>('720p');
  const [recording, setRecording] = useState(false);
  const [take, setTake] = useState<Take | null>(null);
  const [state, setState] = useState<string | null>(null);

  useEffect(() => {
    void mediaDevices()
      .then((found) => {
        setCameras(found.cameras);
        setMicrophones(found.microphones);
      })
      .catch(() => setState('This browser cannot list cameras and microphones'));
    const current = recorder.current;
    return () => current.release();
  }, []);

  const start = async () => {
    setState(null);
    setTake(null);
    try {
      await recorder.current.start({
        source,
        cameraId: cameraId === DEFAULT_DEVICE ? null : cameraId,
        microphoneId: microphoneId === DEFAULT_DEVICE ? null : microphoneId,
        resolution,
      });
      if (preview.current !== null) preview.current.srcObject = recorder.current.preview;
      setRecording(true);
    } catch (error) {
      setState(error instanceof Error ? error.message : 'Recording could not start');
    }
  };

  const stop = async () => {
    const finished = await recorder.current.stop();
    if (preview.current !== null) preview.current.srcObject = null;
    setRecording(false);
    setTake(finished);
  };

  const save = () => {
    if (take === null) return;
    const url = URL.createObjectURL(take.blob);
    Object.assign(document.createElement('a'), {
      href: url,
      download: takeFileName(title, take.mimeType, new Date()),
    }).click();
    URL.revokeObjectURL(url);
  };

  const keep = async () => {
    if (take === null) return;
    setState('Uploading…');
    try {
      await upload(take, title);
      setState('Saved to your recordings');
    } catch (error) {
      setState(error instanceof Error ? error.message : 'The take could not be uploaded');
    }
  };

  const select = (
    label: string,
    key: string,
    value: string,
    onChange: (value: string) => void,
    options: { value: string; label: string }[],
  ) => (
    <div className='flex flex-col gap-1'>
      <Label htmlFor={`${id}-${key}`}>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={recording}>
        <SelectTrigger id={`${id}-${key}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className='flex flex-col gap-4'>
      {select(
        'Record',
        'source',
        source,
        (value) => setSource(RECORDING_SOURCES.find((option) => option === value) ?? 'camera'),
        RECORDING_SOURCES.map((option) => ({ value: option, label: SOURCE_LABELS[option] })),
      )}
      {source !== 'screen' &&
        select('Camera', 'camera', cameraId, setCameraId, [
          { value: DEFAULT_DEVICE, label: 'Default camera' },
          ...cameras.map((camera, index) => ({
            value: camera.deviceId || `camera-${index}`,
            label: camera.label || `Camera ${index + 1}`,
          })),
        ])}
      {select('Microphone', 'microphone', microphoneId, setMicrophoneId, [
        { value: DEFAULT_DEVICE, label: 'Default microphone' },
        ...microphones.map((microphone, index) => ({
          value: microphone.deviceId || `microphone-${index}`,
          label: microphone.label || `Microphone ${index + 1}`,
        })),
      ])}
      {select(
        'Quality',
        'resolution',
        resolution,
        (value) => setResolution(value === '1080p' ? '1080p' : '720p'),
        Object.keys(RESOLUTIONS).map((option) => ({ value: option, label: option })),
      )}
      {/* A muted live preview of what is recorded; it has no speech to caption. */}
      <div className='relative'>
        <video
          ref={preview}
          autoPlay
          muted
          playsInline
          className='bg-muted aspect-video w-full rounded-md'
          aria-label='Recording preview'
        >
          <track kind='captions' />
        </video>
        {!recording && (
          <p className='text-muted-foreground absolute inset-0 flex items-center justify-center p-4 text-center text-sm'>
            What you record shows here once you start.
          </p>
        )}
      </div>
      {recording ? (
        <Button variant='destructive' onClick={() => void stop()}>
          <Square className='mr-2 h-4 w-4' aria-hidden /> Stop recording
        </Button>
      ) : (
        <Button onClick={() => void start()}>
          <Circle className='mr-2 h-4 w-4 fill-current text-red-500' aria-hidden /> Start recording
        </Button>
      )}
      {take !== null && (
        <div className='flex flex-col gap-2 rounded-md border p-3'>
          <p className='text-sm'>Take ready · {clock(take.durationSeconds)}</p>
          <Button variant='outline' onClick={save}>
            <Download className='mr-2 h-4 w-4' aria-hidden /> Download
          </Button>
          {canUpload && (
            <Button variant='outline' onClick={() => void keep()}>
              <CloudUpload className='mr-2 h-4 w-4' aria-hidden /> Save to my recordings
            </Button>
          )}
        </div>
      )}
      {state !== null && (
        <p role='status' className='text-muted-foreground text-sm'>
          {state}
        </p>
      )}
    </div>
  );
}
