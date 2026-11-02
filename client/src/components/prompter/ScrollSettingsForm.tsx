'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useId } from 'react';
import { Input } from 'zephyrex/ui/input';
import { Label } from 'zephyrex/ui/label';
import { RadioGroup, RadioGroupItem } from 'zephyrex/ui/radio-group';
import { Slider } from 'zephyrex/ui/slider';
import {
  SCROLL_MODES,
  SPEED,
  TARGET_DURATION_SECONDS,
  VOICE_ENGINES,
  type PrompterSettings,
  type VoiceEngineName,
} from '~/features/prompter/settings';

export interface ScrollSettingsFormProps {
  settings: PrompterSettings;
  onChange: (settings: PrompterSettings) => void;
  /** Which voice engines this browser and back end can run (and the user's plan unlocks). */
  engines: Record<VoiceEngineName, { available: boolean; note: string }>;
}

const MODE_LABELS: Record<PrompterSettings['scrollMode'], { title: string; text: string }> = {
  manual: { title: 'By hand', text: 'Scroll with the keys, a remote, a pedal or your finger.' },
  constant: { title: 'Steady speed', text: 'Scrolls at the speed you set; change it as you go.' },
  timed: { title: 'Finish on time', text: 'Paces itself to end exactly when you need it to.' },
  voice: { title: 'Follow my voice', text: 'Scrolls as you speak and waits when you pause.' },
};
const ENGINE_LABELS: Record<VoiceEngineName, string> = {
  local: 'On this device (private)',
  browser: "The browser's speech recognition",
  server: 'Our speech recognition (server)',
};
const SECONDS_PER_MINUTE = 60;

export default function ScrollSettingsForm({ settings, onChange, engines }: ScrollSettingsFormProps) {
  const id = useId();
  const set = <K extends keyof PrompterSettings>(key: K, value: PrompterSettings[K]) =>
    onChange({ ...settings, [key]: value });
  const minutes = Math.round((settings.targetDurationSeconds / SECONDS_PER_MINUTE) * 10) / 10;

  return (
    <div className='flex flex-col gap-5'>
      <fieldset className='flex flex-col gap-2'>
        <legend className='mb-2 text-sm font-medium'>How it scrolls</legend>
        <RadioGroup
          value={settings.scrollMode}
          onValueChange={(value) => set('scrollMode', SCROLL_MODES.find((mode) => mode === value) ?? 'constant')}
        >
          {SCROLL_MODES.map((mode) => (
            <div key={mode} className='flex items-start gap-3'>
              <RadioGroupItem id={`${id}-${mode}`} value={mode} className='mt-1' />
              <Label htmlFor={`${id}-${mode}`} className='flex flex-col items-start gap-0.5 font-normal'>
                <span className='font-medium'>{MODE_LABELS[mode].title}</span>
                <span className='text-muted-foreground text-xs'>{MODE_LABELS[mode].text}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </fieldset>

      {settings.scrollMode === 'constant' && (
        <div className='flex flex-col gap-2'>
          <div className='flex justify-between'>
            <Label htmlFor={`${id}-speed`}>Speed</Label>
            <span className='text-muted-foreground text-sm tabular-nums'>{settings.speed} words a minute</span>
          </div>
          <Slider
            id={`${id}-speed`}
            min={SPEED.min}
            max={SPEED.max}
            step={SPEED.step}
            value={[settings.speed]}
            onValueChange={([value]) => set('speed', value)}
            aria-label='Speed'
          />
        </div>
      )}

      {settings.scrollMode === 'timed' && (
        <div className='flex flex-col gap-2'>
          <Label htmlFor={`${id}-minutes`}>Finish in (minutes)</Label>
          <Input
            id={`${id}-minutes`}
            type='number'
            inputMode='decimal'
            min={TARGET_DURATION_SECONDS.min / SECONDS_PER_MINUTE}
            max={TARGET_DURATION_SECONDS.max / SECONDS_PER_MINUTE}
            step={0.5}
            value={minutes}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value) && value > 0) {
                const seconds = Math.round(value * SECONDS_PER_MINUTE);
                set(
                  'targetDurationSeconds',
                  Math.min(TARGET_DURATION_SECONDS.max, Math.max(TARGET_DURATION_SECONDS.min, seconds)),
                );
              }
            }}
          />
        </div>
      )}

      {settings.scrollMode === 'voice' && (
        <fieldset className='flex flex-col gap-2'>
          <legend className='mb-2 text-sm font-medium'>Listen with</legend>
          <RadioGroup
            value={settings.voiceEngine}
            onValueChange={(value) => set('voiceEngine', VOICE_ENGINES.find((engine) => engine === value) ?? 'local')}
          >
            {VOICE_ENGINES.map((engine) => (
              <div key={engine} className='flex items-start gap-3'>
                <RadioGroupItem
                  id={`${id}-${engine}`}
                  value={engine}
                  disabled={!engines[engine].available}
                  className='mt-1'
                />
                <Label htmlFor={`${id}-${engine}`} className='flex flex-col items-start gap-0.5 font-normal'>
                  <span className='font-medium'>{ENGINE_LABELS[engine]}</span>
                  <span className='text-muted-foreground text-xs'>{engines[engine].note}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
          <div className='flex flex-col gap-1'>
            <Label htmlFor={`${id}-language`}>Spoken language</Label>
            <Input
              id={`${id}-language`}
              value={settings.language}
              maxLength={16}
              onChange={(event) => set('language', event.target.value)}
            />
          </div>
        </fieldset>
      )}
    </div>
  );
}
