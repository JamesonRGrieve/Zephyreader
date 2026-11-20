// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type PrompterSettings } from '~/features/prompter/settings';
import DisplaySettingsForm from './DisplaySettingsForm';

/** The form as a page holds it: the settings it shows are the ones it last changed. */
function Harness({ initial, seen }: { initial: Partial<PrompterSettings>; seen: PrompterSettings[] }) {
  const [settings, setSettings] = useState<PrompterSettings>({ ...DEFAULT_SETTINGS, ...initial });
  return (
    <DisplaySettingsForm
      settings={settings}
      onChange={(next) => {
        seen.push(next);
        setSettings(next);
      }}
    />
  );
}

const last = (seen: PrompterSettings[]) => seen[seen.length - 1];

describe('DisplaySettingsForm', () => {
  it('offers its short choices as named chip groups', async () => {
    const seen: PrompterSettings[] = [];
    render(<Harness initial={{ fontFamily: 'sans' }} seen={seen} />);
    const font = screen.getByRole('radiogroup', { name: 'Font' });
    expect(font).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Monospace' }));
    expect(last(seen)?.fontFamily).toBe('mono');
    expect(screen.getByRole('radio', { name: 'Monospace' })).toBeChecked();
  });

  it('shows the colour pickers only for custom colours', async () => {
    const seen: PrompterSettings[] = [];
    render(<Harness initial={{ theme: 'dark' }} seen={seen} />);
    expect(screen.queryByLabelText('Background')).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: 'Custom colours' }));
    expect(last(seen)?.theme).toBe('custom');
    expect(screen.getByLabelText('Background')).toHaveAttribute('type', 'color');
  });

  it('switches mirroring on and off', async () => {
    const seen: PrompterSettings[] = [];
    render(<Harness initial={{ mirrorHorizontal: false }} seen={seen} />);
    await userEvent.click(screen.getByRole('switch', { name: 'Mirror left to right' }));
    expect(last(seen)?.mirrorHorizontal).toBe(true);
  });

  it('asks for the eye line height only while the eye line shows', async () => {
    render(<Harness initial={{ eyeLine: true }} seen={[]} />);
    expect(screen.getByRole('slider', { name: 'Eye line height' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('switch', { name: 'Show the eye line' }));
    expect(screen.queryByRole('slider', { name: 'Eye line height' })).toBeNull();
  });

  it('names every slider, so a screen reader can say what it sets', () => {
    render(<Harness initial={{ eyeLine: true }} seen={[]} />);
    for (const name of ['Text size', 'Line spacing', 'Side margins', 'Eye line height', 'Countdown before scrolling']) {
      expect(screen.getByRole('slider', { name })).toBeInTheDocument();
    }
  });
});
