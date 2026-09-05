import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname =
  typeof __dirname !== 'undefined'
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

/**
 * Standalone unit test config. The host peer is an ordinary registry
 * devDependency (>= 0.0.14); its `/contract` subpath resolves through the
 * package's `exports` map, so no peer alias is needed here.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  test: {
    include: ['src/__tests__/**/*.test.{ts,tsx}'],
    environment: 'node',
    // The codegen tests lazily load the TypeScript compiler (~8 MB) + Prettier;
    // a generous timeout keeps a pass/fail a real signal under worker contention.
    testTimeout: 20000,
    // Process the peer through Vite so the `@` / peer resolution is consistent
    // with the build (the peer package is inlined, not externalized).
    server: {
      deps: {
        inline: ['@theclearsky/react-blender-nodes'],
      },
    },
  },
});
