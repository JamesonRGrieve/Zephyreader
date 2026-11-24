// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, within } from 'storybook/test';
import { SWRConfig } from 'swr';
import { ZephyrexProvider } from 'zephyrex';
import { FOLDERS_KEY, SCRIPTS_KEY } from '~/features/data/records';
import { FOLDERS, SCRIPTS } from '~/stories/fixtures';
import config from '~/zephyrex.config';
import LibraryPage from './LibraryPage';

/**
 * The library page with its data already loaded: SWR is handed the scripts and folders and told
 * not to fetch them again, so the page renders as it does once the server has answered (Storybook
 * has no back end). Loading, failure and every action are covered by LibraryPage.test.tsx.
 */
const meta: Meta<typeof LibraryPage> = {
  title: 'Library/Library page',
  component: LibraryPage,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <ZephyrexProvider config={config}>
        <SWRConfig
          value={{
            fallback: { [SCRIPTS_KEY]: SCRIPTS, [FOLDERS_KEY]: FOLDERS },
            revalidateOnMount: false,
            revalidateOnFocus: false,
            revalidateIfStale: false,
            shouldRetryOnError: false,
          }}
        >
          <Story />
        </SWRConfig>
      </ZephyrexProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof LibraryPage>;

export const Library: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('region', { name: 'Scripts' })).toBeVisible();
    await expect(canvas.getByText('Launch keynote')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'New script' })).toBeEnabled();
  },
};

/** On a phone: the folders wrap above the list. */
export const Phone: Story = { ...Library, globals: { viewport: { value: 'mobile1', isRotated: false } } };
