import type { StorybookConfig } from '@storybook/react-vite';
import { withoutVitePlugins } from '@storybook/builder-vite';

// The plugin's own Storybook: the CodegenStudio (build a graph with the host's
// `FullGraph`, watch `emitGraph` produce a standalone `runGraph` live). It used
// to live in the host library's Storybook; it moved here so the MIT host never
// depends on — or bundles — this AGPL package. The host's Storybook embeds these
// stories from this repo's GitHub Pages by URL instead.
const config: StorybookConfig = {
  stories: ['../src/stories/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  core: {
    disableTelemetry: true,
  },
  async viteFinal(config) {
    // Storybook reuses vite.config.ts (aliases, plugins). The library build's
    // declaration-emitting `vite:dts` plugin has no business in a Storybook
    // build, so drop it here.
    config.plugins = await withoutVitePlugins(config.plugins, ['vite:dts']);
    return config;
  },
};

export default config;
