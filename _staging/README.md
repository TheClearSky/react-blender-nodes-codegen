# `_staging/` — Phase 2 inputs (delete this directory once ported)

Raw material moved OUT of the host repo (`react-blender-nodes`) so that the host
no longer depends on this plugin. Nothing here is wired into the build:
`tsconfig.app.json` includes only `src`, so these files are not type-checked or
tested until Phase 2 adapts them into place.

## Contents

| Path                                               | Origin in host                      | Destination in this repo       |
| -------------------------------------------------- | ----------------------------------- | ------------------------------ |
| `host-contract-tests/*.test.ts` (3 remaining of 7) | `src/__tests__/utils/nodeRunner/**` | `src/__tests__/host-contract/` |

The CodegenStudio stories and the four cleanly-portable tests have been ported
(see "Port status" below) and their staged copies deleted; only the three tests
that need the host's unexported executor remain here.

> **Port status (2026-09-05).**
>
> - **Ported into this repo** (`src/__tests__/host-contract/`, all green):
>   `codegenPluginContract`, `emitGraphAutoEmit`, `emitGraphFanIn` (verbatim,
>   imports repointed to the registry host + `@/index`), plus the codegen halves
>   of `rootIO` (as `rootIoSignature.test.ts`) and `reorderedFanInOrder`
>   (emitted fan-in array order). Their host-only halves live in the host as
>   codegen-free tests (15 cases).
> - **Still blocked — need the host's `execute` / `executeStepByStep`, which are
>   NOT public:** `emitJs.test.ts`, `selfContainedArtifact.test.ts`, and the one
>   `rootIO` parity case that compares `runGraph`'s return against the
>   in-process executor. Options: (a) host exports `execute` /
>   `executeStepByStep` in 0.0.14 (same spirit as exporting `compile`), then
>   port verbatim; (b) rewrite them against hard-coded expected values (loses
>   interpreter parity, keeps emitter coverage). Not decided.
> - The staged copies here stay until the blocked three are resolved. |
>   `CodegenStudio.stories.tsx` | `FullGraph.stories.tsx` lines 1903–2796 +
>   3596–3916 | `stories/` under a new `.storybook/` |

The story file is a byte-faithful extraction (non-ASCII preserved) with three
labelled sections: `[A]` the host's original header imports, `[B]` the studio
component + demo fixtures + the three stories, `[C]` the circuit fixture closure
the studio needs (`circuitExampleDataTypes`, `circuitExampleTypeOfNodes`,
`circuitImplementations`, `circuitCodegenMetadata`, the two run targets).
Section `[C]` is a COPY — those fixtures also remain in the host for its own
circuit stories.

## What must change when porting

1. Every `@/...` import becomes `@theclearsky/react-blender-nodes` (root barrel)
   — the host is now a **registry** devDependency (`^0.0.13`), not a `file:`
   link.
2. Every `@theclearsky/react-blender-nodes-codegen` import becomes a relative
   import into this repo's `src/`.
3. `[A]` imports fixture JSON from the host's `.storybook/static/` — those paths
   do not exist here; the studio stories do not actually use them (they belong
   to other host stories), so drop those lines.

## Host public-surface status of what these files need

Verified against `dist/index.d.ts` of the host working tree (0.0.13):

| Symbol                           | Used by                                           | Public in 0.0.13?                             |
| -------------------------------- | ------------------------------------------------- | --------------------------------------------- |
| `readInput`                      | tests, studio                                     | ✅ yes (also on `/contract`)                  |
| `FunctionImplementations` (type) | tests                                             | ✅ yes                                        |
| `standardDataTypeNamesMap`       | `emitJs.test.ts`                                  | ✅ yes                                        |
| `compile`                        | tests, studio                                     | ✅ **added in 0.0.13** (`src/utils/index.ts`) |
| `serializeExecutionPlan`         | studio (`json-ir` view)                           | ✅ **added in 0.0.13** (`src/utils/index.ts`) |
| `execute`                        | `rootIO`, `emitJs`, `selfContainedArtifact` tests | ❌ **NOT public**                             |
| `executeStepByStep`              | `rootIO.test.ts`                                  | ❌ **NOT public**                             |

**Open decision for Phase 2:** the three tests that call the host's `execute` to
compare interpreter output against the emitted artifact cannot be ported as-is.
Either (a) the host exports `execute` / `executeStepByStep` in 0.0.14 (same
spirit as the Q3-b ruling that exported `compile`), or (b) those tests are
rewritten to drive the interpreter through `FullGraph`'s public runner API. Not
decided; not done. The other four tests port cleanly against 0.0.13.

## Why this exists

The host's Storybook previously **value-imported** this AGPL plugin and
`storybook-deploy.yml` published that Storybook to public GitHub Pages, which
would have attached AGPL §13 to the MIT engine's documentation site. The host
now embeds this plugin's stories by URL (an `<iframe>` into this repo's own
Pages deployment), so no AGPL code enters the host artifact. Both sites live
under `theclearsky.github.io` and are therefore same-origin.
