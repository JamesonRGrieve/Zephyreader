// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { LiveDevice } from '~/features/sync/liveChannel';
import DevicesPanel, { type DevicesPanelProps } from './DevicesPanel';

const DEVICES: LiveDevice[] = [
  { client_id: 'laptop', label: 'Chrome on macOS', main: true, connected: true },
  { client_id: 'tablet', label: null, main: false, connected: true },
];

function renderPanel(overrides: Partial<DevicesPanelProps> = {}) {
  const props: DevicesPanelProps = {
    devices: DEVICES,
    thisDevice: 'tablet',
    isMain: false,
    connected: true,
    remoteHref: '/remote?script=script-1',
    onClaim: vi.fn(),
    ...overrides,
  };
  render(<DevicesPanel {...props} />);
  return props;
}

describe('DevicesPanel', () => {
  it('lists the devices, marking this one and the one leading', () => {
    renderPanel();
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Chrome on macOS');
    expect(within(rows[0] as HTMLElement).getByLabelText('Leading')).toBeInTheDocument();
    // A device that never named itself shows its id.
    expect(rows[1]).toHaveTextContent('tablet');
    expect(within(rows[1] as HTMLElement).getByText('This device')).toBeInTheDocument();
  });

  it('lets a following device take the lead', async () => {
    const props = renderPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Lead from this device' }));
    expect(props.onClaim).toHaveBeenCalledTimes(1);
  });

  it('offers no lead to the device already leading', () => {
    renderPanel({ thisDevice: 'laptop', isMain: true });
    expect(screen.queryByRole('button', { name: 'Lead from this device' })).toBeNull();
  });

  it('says when it is reconnecting, and links the remote control in a new tab', () => {
    renderPanel({ connected: false });
    expect(screen.getByRole('status')).toHaveTextContent('Reconnecting…');
    const remote = screen.getByRole('link', { name: 'Open the remote control' });
    expect(remote).toHaveAttribute('href', '/remote?script=script-1');
    expect(remote).toHaveAttribute('target', '_blank');
  });
});
