// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Preview } from '@storybook/react';
import '../src/app/globals.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/ },
    },
    nextjs: {
      appDirectory: true,
    },
  },
};

export default preview;
