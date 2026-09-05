import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname =
  typeof __dirname !== 'undefined'
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

// Single-entry library build (ES + UMD) for the codegen plugin.
//
// Externals: `typescript` is a lazy `import('typescript')` (kept out of the
// bundle, like the host library); the host's React-free `/contract` subpath is a
// peer (never bundled). `prettier/standalone` IS bundled (mirrors the host).
//
// UMD boundary (documented, non-defect): a browser-`<script>` UMD consumer would
// need `window['react-blender-nodes-contract']`, which the host's es+cjs-only
// `/contract` build never defines — but a `typescript`-dependent codegen tool has
// no realistic browser-global audience; the ESM (`import`) and CJS (`require`,
// `.umd.cjs`) paths resolve the peer normally.
export default defineConfig({
  plugins: [dts({ rollupTypes: true, tsconfigPath: './tsconfig.app.json' })],
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  build: {
    lib: {
      entry: ['src/index.ts'],
      name: 'react-blender-nodes-codegen',
      fileName: (format) =>
        format === 'umd'
          ? 'react-blender-nodes-codegen.umd.cjs'
          : 'react-blender-nodes-codegen.es.js',
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: ['typescript', '@theclearsky/react-blender-nodes/contract'],
      output: {
        globals: {
          typescript: 'ts',
          '@theclearsky/react-blender-nodes/contract':
            'react-blender-nodes-contract',
        },
      },
    },
    sourcemap: false,
    emptyOutDir: true,
  },
});
