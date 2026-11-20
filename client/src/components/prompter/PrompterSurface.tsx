'use client';
// SPDX-License-Identifier: AGPL-3.0-or-later
import { forwardRef, memo, type CSSProperties } from 'react';
import type { PreparedScript, WordStyle } from '~/features/prompter/script';
import { colours, FONT_STACKS, mirrorTransform, type PrompterSettings } from '~/features/prompter/settings';

export interface PrompterSurfaceProps {
  script: PreparedScript;
  settings: PrompterSettings;
  /** The word on the reading line, highlighted when the setting is on. */
  readingWord: number | null;
  /** Fired when the reader scrolls by hand (wheel, touch, scrollbar). */
  onManualScroll?: () => void;
}

const WORD_CLASSES: Record<WordStyle, string> = {
  plain: '',
  bold: 'font-bold',
  italic: 'italic',
  highlight: 'rounded-sm bg-yellow-300/40 px-0.5',
};

const Words = memo(function Words({ script }: { script: PreparedScript }) {
  return (
    <>
      {script.blocks.map((block) => {
        const Tag = block.kind === 'heading' ? 'h2' : 'p';
        return (
          <Tag
            key={block.words[0].index}
            className={block.kind === 'heading' ? 'mb-[0.6em] mt-[1.2em] font-bold' : 'mb-[1em]'}
            data-cue={block.cue ? 'true' : undefined}
          >
            {block.words.map((word) => (
              <span key={word.index} data-word={word.index} className={WORD_CLASSES[word.style]}>
                {word.text}{' '}
              </span>
            ))}
          </Tag>
        );
      })}
    </>
  );
});

/**
 * The script as the presenter reads it: the scrolling element itself (the view drives its
 * scrollTop), drawn in the presenter's colours, font and size, mirrored for a
 * beam-splitter rig, with the eye line marked and the word on it highlighted.
 */
const PrompterSurface = forwardRef<HTMLDivElement, PrompterSurfaceProps>(function PrompterSurface(
  { script, settings, readingWord, onManualScroll },
  ref,
) {
  const { text, background } = colours(settings);
  const eyeLine = `${settings.eyeLinePosition * 100}%`;
  const style: CSSProperties = {
    color: text,
    backgroundColor: background,
    fontFamily: FONT_STACKS[settings.fontFamily],
    fontSize: `${settings.fontSize}px`,
    lineHeight: settings.lineHeight,
    textAlign: settings.align,
    textTransform: settings.allCaps ? 'uppercase' : 'none',
    // A word wider than the screen breaks rather than pushing the prompter sideways.
    overflowWrap: 'anywhere',
    transform: mirrorTransform(settings),
  };
  return (
    <div className='relative h-full w-full overflow-hidden' style={{ backgroundColor: background }}>
      <div
        ref={ref}
        tabIndex={0}
        aria-label='Script'
        onWheel={onManualScroll}
        onTouchMove={onManualScroll}
        className='prompter-scroll relative h-full w-full overflow-y-auto overscroll-contain outline-none'
        style={style}
      >
        <div style={{ height: eyeLine }} aria-hidden />
        <div style={{ paddingLeft: `${settings.marginPercent}%`, paddingRight: `${settings.marginPercent}%` }}>
          <Words script={script} />
          <p className='opacity-50' aria-hidden>
            ■
          </p>
        </div>
        <div style={{ height: '100%' }} aria-hidden />
        {settings.highlightReadingLine && readingWord !== null && (
          <style>{`[data-word="${readingWord}"] { text-decoration: underline; text-decoration-thickness: 0.08em; text-underline-offset: 0.18em; }`}</style>
        )}
      </div>
      {settings.eyeLine && (
        <div
          aria-hidden
          className='pointer-events-none absolute left-0 right-0 flex items-center'
          style={{ top: eyeLine, transform: 'translateY(-50%)' }}
        >
          <span
            className='h-0 w-0 border-y-[12px] border-l-[18px] border-y-transparent'
            style={{ borderLeftColor: text, opacity: 0.8 }}
          />
          <span className='h-px flex-1' style={{ backgroundColor: text, opacity: 0.25 }} />
          <span
            className='h-0 w-0 border-y-[12px] border-r-[18px] border-y-transparent'
            style={{ borderRightColor: text, opacity: 0.8 }}
          />
        </div>
      )}
    </div>
  );
});

export default PrompterSurface;
