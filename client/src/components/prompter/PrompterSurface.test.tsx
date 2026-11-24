// SPDX-License-Identifier: AGPL-3.0-or-later
import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { prepareScript } from '~/features/prompter/script';
import { DEFAULT_SETTINGS, type PrompterSettings } from '~/features/prompter/settings';
import PrompterSurface from './PrompterSurface';

const SCRIPT = prepareScript('# Opening\n\nGood evening [smile] **everyone**.\n\nTonight we launch.');

function surface(settings: Partial<PrompterSettings> = {}, readingWord: number | null = null) {
  const ref = createRef<HTMLElement>();
  const onManualScroll = vi.fn();
  const view = render(
    <PrompterSurface
      ref={ref}
      script={SCRIPT}
      settings={{ ...DEFAULT_SETTINGS, ...settings }}
      readingWord={readingWord}
      onManualScroll={onManualScroll}
    />,
  );
  return { ...view, ref, onManualScroll, region: screen.getByRole('region', { name: 'Script' }) };
}

describe('PrompterSurface', () => {
  it('is the scrolling Script region the view drives, reachable by keyboard', () => {
    const { ref, region } = surface();
    expect(ref.current).toBe(region);
    expect(region).toHaveAttribute('tabindex', '0');
  });

  it('shows the spoken words only, headings as headings, each word marked for voice-follow', () => {
    const { region } = surface();
    expect(screen.getByRole('heading', { level: 2, name: 'Opening' })).toBeInTheDocument();
    expect(region).toHaveTextContent('Good evening everyone.');
    expect(region).not.toHaveTextContent('smile');
    const words = region.querySelectorAll('[data-word]');
    expect(words).toHaveLength(SCRIPT.words.length);
    expect(region.querySelector('[data-word="3"]')).toHaveClass('font-bold');
  });

  it('mirrors the script for a beam-splitter rig', () => {
    expect(surface({ mirrorHorizontal: true }).region.style.transform).toBe('scale(-1, 1)');
  });

  it('marks the eye line and underlines the word on it only when those settings are on', () => {
    const on = surface({ eyeLine: true, highlightReadingLine: true }, 2);
    expect(on.container.querySelector('style')?.textContent).toContain('[data-word="2"]');
    expect(on.container.querySelectorAll('[aria-hidden].pointer-events-none')).toHaveLength(1);
    on.unmount();

    const off = surface({ eyeLine: false, highlightReadingLine: false }, 2);
    expect(off.container.querySelector('style')).toBeNull();
    expect(off.container.querySelectorAll('[aria-hidden].pointer-events-none')).toHaveLength(0);
  });

  it('says when the reader scrolls by hand', () => {
    const { region, onManualScroll } = surface();
    fireEvent.wheel(region);
    fireEvent.touchMove(region);
    expect(onManualScroll).toHaveBeenCalledTimes(2);
  });
});
