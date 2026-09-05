import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: ['src/index.ts', 'demo/emit-demo.mjs'],
  project: ['src/**/*.{ts,tsx}'],
};

export default config;
