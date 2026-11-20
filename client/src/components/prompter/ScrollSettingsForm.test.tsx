// SPDX-License-Identifier: AGPL-3.0-or-later
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type PrompterSettings } from '~/features/prompter/settings';
import ScrollSettingsForm, { type ScrollSettingsFormProps } from './ScrollSettingsForm';

const ENGINES: ScrollSettingsFormProps['engines'] = {
  local: { available: true, note: 'Your voice never leaves this device.' },
  browser: { available: false, note: 'Not in this browser.' },
  server: { available: true, note: 'Included in paid plans.' },
};

/** The form as a page holds it: the settings it shows are the ones it last changed. */
function Harness({ initial, seen }: { initial: Partial<PrompterSettings>; seen: PrompterSettings[] }) {
  const [settings, setSettings] = useState<PrompterSettings>({ ...DEFAULT_SETTINGS, ...initial });
  return (
    <ScrollSettingsForm
      settings={settings}
      engines={ENGINES}
      onChange={(next) => {
        seen.push(next);
        setSettings(next);
      }}
    />
  );
}

const last = (seen: PrompterSettings[]) => seen[seen.length - 1];

describe('ScrollSettingsForm', () => {
  it('chooses how the prompter scrolls, and shows the speed only for a steady speed', async () => {
    const seen: PrompterSettings[] = [];
    render(<Harness initial={{ scrollMode: 'constant' }} seen={seen} />);
    expect(screen.getByRole('slider', { name: 'Speed' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Finish on time/ }));
    expect(last(seen)?.scrollMode).toBe('timed');
    expect(screen.queryByRole('slider', { name: 'Speed' })).toBeNull();
  });

  it('takes a finishing time in minutes and keeps it within the limits', () => {
    const seen: PrompterSettings[] = [];
    render(<Harness initial={{ scrollMode: 'timed', targetDurationSeconds: 300 }} seen={seen} />);
    const minutes = screen.getByLabelText('Finish in (minutes)');
    expect(minutes).toHaveValue(5);
    fireEvent.change(minutes, { target: { value: '2.5' } });
    expect(last(seen)?.targetDurationSeconds).toBe(150);
    // Five hours is past the four-hour limit; nothing at all is ignored.
    fireEvent.change(minutes, { target: { value: '300' } });
    expect(last(seen)?.targetDurationSeconds).toBe(4 * 60 * 60);
    const before = seen.length;
    fireEvent.change(minutes, { target: { value: '0' } });
    expect(seen).toHaveLength(before);
  });

  it('offers only the voice engines this browser and back end can run', () => {
    render(<Harness initial={{ scrollMode: 'voice' }} seen={[]} />);
    expect(screen.getByRole('radio', { name: /On this device/ })).toBeEnabled();
    expect(screen.getByRole('radio', { name: /^The browser/ })).toBeDisabled();
    expect(screen.getByText('Not in this browser.')).toBeInTheDocument();
  });

  it('keeps the spoken language within its limit', async () => {
    const seen: PrompterSettings[] = [];
    render(<Harness initial={{ scrollMode: 'voice', language: 'en' }} seen={seen} />);
    const language = screen.getByLabelText('Spoken language');
    expect(language).toHaveAttribute('maxLength', '16');
    await userEvent.clear(language);
    await userEvent.type(language, 'fr-CA');
    expect(last(seen)?.language).toBe('fr-CA');
  });
});
