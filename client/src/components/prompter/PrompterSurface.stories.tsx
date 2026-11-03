// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, within } from 'storybook/test';
import { prepareScript } from '~/features/prompter/script';
import { DEFAULT_SETTINGS } from '~/features/prompter/settings';
import { KEYNOTE_TEXT } from '~/stories/fixtures';
import PrompterSurface from './PrompterSurface';

const meta: Meta<typeof PrompterSurface> = {
  title: 'Prompter/Surface',
  component: PrompterSurface,
  tags: ['autodocs'],
  args: { script: prepareScript(KEYNOTE_TEXT), settings: DEFAULT_SETTINGS, readingWord: 2 },
  decorators: [(Story) => <div style={{ height: 480, display: 'flex' }}>{Story()}</div>],
};
export default meta;
type Story = StoryObj<typeof PrompterSurface>;

/** Cue notes are for the editor, never the prompter. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const surface = within(canvasElement).getByLabelText('Script', { exact: true });
    await expect(surface).toHaveTextContent('Good evening, everyone.');
    await expect(surface).not.toHaveTextContent('smile, pause');
  },
};

export const YellowOnBlackInCapitals: Story = {
  args: { settings: { ...DEFAULT_SETTINGS, theme: 'high-contrast', allCaps: true } },
};
