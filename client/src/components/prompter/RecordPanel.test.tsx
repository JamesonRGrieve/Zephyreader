// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Take } from '~/features/recording/recorder';
import RecordPanel from './RecordPanel';

const TAKE: Take = { blob: new Blob(['video']), mimeType: 'video/webm', durationSeconds: 12 };

const media = vi.hoisted(() => ({
  devices: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
}));

vi.mock('~/features/recording/recorder', async (original) => ({
  ...(await original<typeof import('~/features/recording/recorder')>()),
  mediaDevices: media.devices,
  TakeRecorder: class {
    preview = null;
    start = media.start;
    stop = media.stop;
    release = vi.fn();
  },
}));

describe('RecordPanel', () => {
  beforeEach(() => {
    media.devices.mockReset().mockResolvedValue({ cameras: [], microphones: [] });
    media.start.mockReset().mockResolvedValue(undefined);
    media.stop.mockReset().mockResolvedValue(TAKE);
  });

  it('records a take and offers to keep it where the plan allows', async () => {
    const upload = vi.fn().mockResolvedValue(undefined);
    render(<RecordPanel title='Keynote' canUpload upload={upload} />);
    await userEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    expect(media.start).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'camera', resolution: '720p', cameraId: null }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    expect(screen.getByText('Take ready · 0:12')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save to my recordings' }));
    expect(upload).toHaveBeenCalledWith(TAKE, 'Keynote');
    expect(await screen.findByRole('status')).toHaveTextContent('Saved to your recordings');
  });

  it('offers only the download where takes are not kept in the cloud', async () => {
    render(<RecordPanel title='Keynote' canUpload={false} upload={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await userEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save to my recordings' })).toBeNull();
  });

  it('says why recording could not start, or the take could not be kept', async () => {
    media.start.mockRejectedValueOnce(new Error('Camera permission was refused'));
    const upload = vi.fn().mockRejectedValue(new Error('The take is too large'));
    render(<RecordPanel title='Keynote' canUpload upload={upload} />);
    await userEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Camera permission was refused');
    await userEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await userEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save to my recordings' }));
    expect(await screen.findByText('The take is too large')).toHaveAttribute('role', 'status');
  });

  it('says so when the browser cannot list cameras and microphones', async () => {
    media.devices.mockRejectedValueOnce(new Error('NotAllowedError'));
    render(<RecordPanel title='Keynote' canUpload={false} upload={vi.fn()} />);
    expect(await screen.findByRole('status')).toHaveTextContent('This browser cannot list cameras and microphones');
  });
});
