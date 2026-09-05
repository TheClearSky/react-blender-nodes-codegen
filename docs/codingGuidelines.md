# Coding Guidelines

This package follows the same TypeScript/tooling conventions as the host
library,
[`@theclearsky/react-blender-nodes`](https://github.com/TheClearSky/react-blender-nodes)
— see its `docs/codingGuidelines.md` for the full reference. The essentials that
apply here:

- **`npm run build` is the source of truth** (`tsc -b` + Vite lib build +
  `scripts/check-dist-types.ts`). `vitest` and `eslint` do NOT type-check.
- **No enums, no default exports, `function` declarations** for top-level
  functions; named exports only.
- **`verbatimModuleSyntax`**: values and types are re-exported in SEPARATE
  statements (`export { … }` vs `export type { … }`).
- **The codegen boundary**: `src/codegen/**` reaches the host library ONLY
  through `src/codegen/contract.ts` (enforced by an ESLint
  `no-restricted-imports` rule).
- **Full descriptive identifier names** — no `cfg`/`tgtIdx` abbreviations.
- **Doc citations** use the backtick-wrapped-path, then `›`, then a
  backtick-wrapped Symbol name, and are checked by `npm run check:docs`; cite
  plugin-local paths only (host symbols go in prose).
