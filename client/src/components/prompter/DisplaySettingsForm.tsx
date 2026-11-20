'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useId, type ReactNode } from 'react';
import { chipGroup } from 'zephyrex/hooks/chipKeys';
import { ChoiceChip } from 'zephyrex/ui/choice-chip';
import { Input } from 'zephyrex/ui/input';
import { Label } from 'zephyrex/ui/label';
import { Slider } from 'zephyrex/ui/slider';
import { Switch } from 'zephyrex/ui/switch';
import {
  ALIGNMENTS,
  COUNTDOWN_SECONDS,
  EYE_LINE,
  FONT_FAMILIES,
  FONT_SIZE,
  LINE_HEIGHT,
  MARGIN_PERCENT,
  THEMES,
  type PrompterSettings,
} from '~/features/prompter/settings';

export interface DisplaySettingsFormProps {
  settings: PrompterSettings;
  onChange: (settings: PrompterSettings) => void;
}

const THEME_LABELS: Record<PrompterSettings['theme'], string> = {
  dark: 'White on black',
  light: 'Black on white',
  'high-contrast': 'Yellow on black',
  custom: 'Custom colours',
};
const FONT_LABELS: Record<PrompterSettings['fontFamily'], string> = {
  sans: 'Sans serif',
  serif: 'Serif',
  mono: 'Monospace',
  rounded: 'Rounded',
};
const SLIDER_LABELS = {
  fontSize: 'Text size',
  lineHeight: 'Line spacing',
  marginPercent: 'Side margins',
  eyeLinePosition: 'Eye line height',
  countdownSeconds: 'Countdown before scrolling',
} as const;
const ALIGN_LABELS: Record<PrompterSettings['align'], string> = { left: 'Left', center: 'Centred' };

function Row({ label, htmlFor, children, value }: { label: string; htmlFor: string; children: ReactNode; value?: string }) {
  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-center justify-between'>
        <Label htmlFor={htmlFor}>{label}</Label>
        {value !== undefined && <span className='text-muted-foreground text-sm tabular-nums'>{value}</span>}
      </div>
      {children}
    </div>
  );
}

/** A short set of choices, all in view: chips that read as one radio group, moved through with the arrow keys. */
function Choices<T extends string>({
  label,
  options,
  labels,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (value: T) => void;
}) {
  const labelId = useId();
  return (
    <div className='flex flex-col gap-2'>
      <span id={labelId} className='text-sm font-medium leading-none'>
        {label}
      </span>
      <div role='radiogroup' aria-labelledby={labelId} className='flex flex-wrap gap-1.5' ref={chipGroup}>
        {options.map((option) => (
          <ChoiceChip
            key={option}
            checked={value === option}
            // Choosing the chosen one again keeps it: every setting here always has a value.
            onClick={() => onChange(option)}
          >
            {labels[option]}
          </ChoiceChip>
        ))}
      </div>
    </div>
  );
}

/** How the prompter looks: size, font, spacing, colours, mirroring, eye line and countdown. */
export default function DisplaySettingsForm({ settings, onChange }: DisplaySettingsFormProps) {
  const id = useId();
  const set = <K extends keyof PrompterSettings>(key: K, value: PrompterSettings[K]) =>
    onChange({ ...settings, [key]: value });
  const slider = (key: keyof typeof SLIDER_LABELS, range: { min: number; max: number; step?: number }) => (
    <Slider
      id={`${id}-${key}`}
      min={range.min}
      max={range.max}
      step={range.step ?? 1}
      value={[settings[key]]}
      onValueChange={([value]) => set(key, value)}
      aria-label={SLIDER_LABELS[key]}
    />
  );
  const toggle = (
    key: 'allCaps' | 'mirrorHorizontal' | 'mirrorVertical' | 'eyeLine' | 'highlightReadingLine',
    label: string,
  ) => (
    <div className='flex items-center justify-between gap-4'>
      <Label htmlFor={`${id}-${key}`}>{label}</Label>
      <Switch id={`${id}-${key}`} checked={settings[key]} onCheckedChange={(checked) => set(key, checked)} />
    </div>
  );

  return (
    <div className='flex flex-col gap-5'>
      <Row label='Text size' htmlFor={`${id}-fontSize`} value={`${settings.fontSize}px`}>
        {slider('fontSize', FONT_SIZE)}
      </Row>
      <Choices
        label='Font'
        options={FONT_FAMILIES}
        labels={FONT_LABELS}
        value={settings.fontFamily}
        onChange={(value) => set('fontFamily', value)}
      />
      <Row label='Line spacing' htmlFor={`${id}-lineHeight`} value={settings.lineHeight.toFixed(2)}>
        {slider('lineHeight', LINE_HEIGHT)}
      </Row>
      <Row label='Side margins' htmlFor={`${id}-marginPercent`} value={`${settings.marginPercent}%`}>
        {slider('marginPercent', MARGIN_PERCENT)}
      </Row>
      <Choices
        label='Alignment'
        options={ALIGNMENTS}
        labels={ALIGN_LABELS}
        value={settings.align}
        onChange={(value) => set('align', value)}
      />
      <Choices
        label='Colours'
        options={THEMES}
        labels={THEME_LABELS}
        value={settings.theme}
        onChange={(value) => set('theme', value)}
      />
      {settings.theme === 'custom' && (
        <div className='grid grid-cols-2 gap-4'>
          <Row label='Text' htmlFor={`${id}-text`}>
            <Input
              id={`${id}-text`}
              type='color'
              value={settings.textColour}
              onChange={(event) => set('textColour', event.target.value)}
            />
          </Row>
          <Row label='Background' htmlFor={`${id}-background`}>
            <Input
              id={`${id}-background`}
              type='color'
              value={settings.backgroundColour}
              onChange={(event) => set('backgroundColour', event.target.value)}
            />
          </Row>
        </div>
      )}
      {toggle('allCaps', 'All capitals')}
      {toggle('mirrorHorizontal', 'Mirror left to right')}
      {toggle('mirrorVertical', 'Mirror top to bottom')}
      {toggle('eyeLine', 'Show the eye line')}
      {settings.eyeLine && (
        <Row
          label='Eye line height'
          htmlFor={`${id}-eyeLinePosition`}
          value={`${Math.round(settings.eyeLinePosition * 100)}% from the top`}
        >
          {slider('eyeLinePosition', EYE_LINE)}
        </Row>
      )}
      {toggle('highlightReadingLine', 'Underline the word on the eye line')}
      <Row label='Countdown before scrolling' htmlFor={`${id}-countdownSeconds`} value={`${settings.countdownSeconds}s`}>
        {slider('countdownSeconds', COUNTDOWN_SECONDS)}
      </Row>
    </div>
  );
}
