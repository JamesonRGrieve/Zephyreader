// SPDX-License-Identifier: AGPL-3.0-or-later
import path from 'path';
import type { StorybookConfig } from '@storybook/nextjs';

const here = import.meta.dirname;
const ZEPHYREX_SRC = path.resolve(here, '../node_modules/zephyrex/src');
const APP_SRC = path.resolve(here, '../src');

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
    // Keep the linked framework at its `node_modules/zephyrex` path (don't
    // realpath to the sibling checkout) so `transpilePackages` compiles its TSX.
    webpackConfig.resolve.symlinks = false;
    webpackConfig.resolve.alias = {
      ...(webpackConfig.resolve.alias || {}),
      // Framework-internal alias -> linked package source (matches next.config.js).
      '@': ZEPHYREX_SRC,
      '~': APP_SRC,
    };
    // With symlinks:false the framework resolves react from this app's single
    // copy; do NOT alias react/react-dom (that reintroduces a duplicate React
    // and null hook dispatchers — "Cannot read properties of null").
    return webpackConfig;
  },
};

export default config;
