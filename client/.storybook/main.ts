// SPDX-License-Identifier: AGPL-3.0-or-later
import path from 'path';
import type { StorybookConfig } from '@storybook/nextjs';

const APP_SRC = path.resolve(import.meta.dirname, '../src');

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx|mdx)'],
  // Storybook 10 folds actions/controls/interactions/viewport into core; only
  // links and a11y remain as separate addons here.
  addons: ['@storybook/addon-links', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  staticDirs: ['../public'],
  core: {
    disableTelemetry: true,
  },
  webpackFinal: async (webpackConfig) => {
    webpackConfig.resolve = webpackConfig.resolve || {};
    // This app's `~/*` alias (tsconfig paths); the framework is a compiled package.
    webpackConfig.resolve.alias = { ...(webpackConfig.resolve.alias || {}), '~': APP_SRC };
    return webpackConfig;
  },
};

export default config;
