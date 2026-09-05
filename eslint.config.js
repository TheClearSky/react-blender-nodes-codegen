import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { globalIgnores } from 'eslint/config';

export default tseslint.config([
  // `storybook-static` is the CodegenStudio's built site (gitignored); linting
  // its bundled runtime trips "definition for rule … not found" on the
  // upstream inline directives it carries. Mirrors the host's ignore list.
  globalIgnores(['dist', 'coverage', 'storybook-static']),
  {
    files: ['**/*.{ts,mts,cts}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      // Node (scripts/demo) + browser (the shipped codegen may run in-browser).
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    // Codegen extraction boundary: `src/codegen/**` reaches the host library ONLY
    // through `./contract` (which alone imports the peer's `/contract` subpath).
    // `src/codegenRunTarget.ts`, `src/index.ts`, and `src/__tests__/**` sit OUTSIDE
    // this glob and may import the peer freely.
    files: ['src/codegen/**/*.ts'],
    ignores: ['src/codegen/contract.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '../**',
                '@/**',
                '@theclearsky/react-blender-nodes',
                '@theclearsky/react-blender-nodes/**',
                'react',
                'react-dom',
                '@xyflow/**',
              ],
              message:
                'codegen core reaches the host library only through ./contract (the extraction boundary). See docs/codegenDoc.md.',
            },
          ],
        },
      ],
    },
  },
]);
