# Contributing

## Prerequisites

- Node 20+ (CI uses 24.x).

The host library
[`@theclearsky/react-blender-nodes`](https://github.com/TheClearSky/react-blender-nodes)
is an ordinary registry devDependency (`>= 0.0.14`; the React-free `/contract`
subpath this plugin imports has shipped since 0.0.13). No sibling checkout, no
`file:` link, no host build.

## Setup

```bash
npm install
npm run build
npm run test:unit
```

The peer's `/contract` subpath resolves through its node_modules **exports map**
(→ the host's published `dist/contract.d.ts`), NOT a tsconfig `paths` entry.
This is deliberate and load-bearing: a `paths` entry makes API Extractor treat
the peer as a LOCAL file and INLINE its types into the rolled `dist/index.d.ts`
— which re-binds the inlined React `CSSProperties` to THIS repo's `@types/react`
and breaks assignability against a consumer's own React tree (the classic
dual-`@types/react` failure). Resolving via node_modules keeps the peer
EXTERNAL, so the rolled `.d.ts` carries bare
`import … from '@theclearsky/react-blender-nodes/contract'` lines that each
consumer resolves against their own install (`@types/react` included — the
peer-like posture the clean-room gate below documents). `zod` is pinned to the
host's exact version (an exact `package.json` spec, not a range) so the shared
4-parameter generic (`ComplexSchemaType extends z.ZodType`) unifies across the
two installs; a real consumer install dedupes to one `zod`.

The plugin's shipped code imports the host ONLY through `/contract`. Its
Storybook (the CodegenStudio) and its host-contract tests — dev-time only —
additionally use the host's root barrel (`compile`, `serializeExecutionPlan`,
`FullGraph`, …). The host's Storybook embeds the studio from THIS repo's GitHub
Pages by URL (an `<iframe>`), so the host never depends on this package.

## The gate set

`npm run build` is the source of truth (`tsc -b` + Vite lib build +
`scripts/check-dist-types.ts` + `scripts/check-dist-loads.ts`). Run all of these
before declaring done:

| Command              | Checks                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `npm run build`      | `tsc -b` + bundle + the self-contained `dist/index.d.ts` gate + the dist smoke-load probes |
| `npm run lint`       | ESLint (incl. the codegen boundary rule)                                                   |
| `npm run test:unit`  | Vitest (the codegen unit + form tests)                                                     |
| `npm run check:docs` | doc-citation resolution                                                                    |
| `npm run demo`       | headless smoke — emits a `runGraph` under bare Node                                        |

## Code style

Same as the host library — see
[docs/codingGuidelines.md](./docs/codingGuidelines.md). `src/codegen/**` reaches
the host ONLY through `src/codegen/contract.ts` (enforced by an ESLint rule).

## Compatibility policy (read before changing versions)

The plugin's public d.ts re-exposes host types and runs against a _range_ of
host versions (`peerDependencies: ">=0.0.14 <1"`). Two changes require a
**coordinated release** (a new plugin version that raises the peer floor),
because a published plugin binary never recompiles against a newer host:

1. **A new `ExecutionPlan` step kind / IR field / `/contract` export in the
   host.** A newer host emitting a step kind this codegen predates hits the
   IR-evolution guard (`src/codegen/lower.ts` — a `default` arm that throws,
   naming both packages) rather than miscompiling. Handle the new kind + bump
   the peer floor.
2. **A dep↔peer reclassification of a `/contract`-reachable external**
   (`@xyflow/react`, `@xyflow/system`, `immer`, `react`, `zod`) in the host — it
   changes how the peer's types hoist for consumers.

## Building and Publishing (the release train)

Publishing is **CI-only** via GitHub Actions (`library-deploy.yml`): lint →
check:docs → test → build (including the `check-dist-types` + `check-dist-loads`
artifact gates) → `npm publish --provenance` on a push to `main`, under OIDC
trusted publishing (environment `npm`, no long-lived token). The workflow is a
plain single checkout: the host peer comes from the registry, so nothing is
bootstrapped and no other repo is checked out.

The dependency between the two packages is strictly one-way — this plugin
depends on the host; the host does not depend on this plugin — so the release
order is simply:

1. **Host first.** A contract-surface change (a new `/contract` export, a new IR
   step kind) ships as an additive host release.
2. **This package second**, raising its peer floor to that host version.

A push to `main` whose `package.json` version is already on the registry
**skips** the publish step (the workflow checks `npm view` first) instead of
failing, so doc-only pushes stay green; bump the version to release.

**How the package was bootstrapped (done once, 2026-09-06):** npm registers a
trusted publisher only for a package that already exists, so 0.0.1 was published
by hand to create the package. The trusted publisher (org `TheClearSky` / repo
`react-blender-nodes-codegen` / `library-deploy.yml` / environment `npm`) was
then registered and token-based publishing disallowed on npmjs.com. Every
version from 0.0.2 on is published by CI only; there is no token anywhere.

## The clean-room type gate

`check-dist-types` proves `dist/index.d.ts` is self-contained but resolves the
peer's externals from this repo's `node_modules` — it CANNOT catch a missing
plugin-side pin (notably `@types/react`, which a real consumer supplies). To
verify the plugin's own dependency closure the way a consumer sees it, run a
clean-room check: `npm pack` this package, install the tarball (plus the host
from the registry) into a throwaway directory, then `tsc` a consumer file
against `dist/index.d.ts`. `@types/react` is documented as consumer-provided
(mirroring the host's react-is-a-peer posture).

## No git actions from automation

The working tree may carry uncommitted work; commit/reset/rebase are done by
hand.
