# Codegen — `@theclearsky/react-blender-nodes-codegen`

This package compiles a `@theclearsky/react-blender-nodes` graph into a
standalone, dependency-free `runGraph` source module. It is the codegen half of
the editor, extracted so the base library carries no `typescript`/`prettier`
weight and so codegen can evolve on its own release cadence.

## Install

```bash
npm i @theclearsky/react-blender-nodes-codegen
```

It declares `@theclearsky/react-blender-nodes` as a **peer** dependency (you
already have it), plus `typescript` and `prettier` as regular dependencies (the
AST substrate + the beautify pass). It reaches the host library ONLY through the
host's React-free `@theclearsky/react-blender-nodes/contract` subpath, so it
pulls no React at runtime.

## Two entry points

### 1. Run targets (editor-facing)

`src/codegenRunTarget.ts` › `codegenJsRunTarget` and `src/codegenRunTarget.ts` ›
`codegenTsRunTarget` are `artifact` run targets — pass them to
`<FullGraph runTargets={[…]} />` and they appear in the split Run button;
clicking Run emits + downloads the module. Build a custom one (id / label /
target language / opt-in passes) with `src/codegenRunTarget.ts` ›
`makeCodegenRunTarget`; its options are `src/codegenRunTarget.ts` ›
`CodegenRunTargetOptions`.

### 2. Programmatic emit (headless)

`src/codegen/emitGraph.ts` › `emitGraph` is the async v2 entry point:

```ts
import { emitGraph } from '@theclearsky/react-blender-nodes-codegen';
const source = await emitGraph(plan, state, { target: 'javascript' });
```

`src/codegen/emitJs.ts` › `emitJs` is the lower-level synchronous string emit
that `emitGraph` wraps (before the opt-in AST passes + Prettier).

**Obtaining an `ExecutionPlan`.** The supported source is a run-target's
`context.executionPlan` (the editor's `compile(state)`, wired through the graph
UI). Hand-built plans are supported-but-advanced — see `demo/emit-demo.mjs`,
which builds a small `{ plan, state }` fixture and prints the emitted
`runGraph`. Note an `ExecutionPlan` carries `Map`s, so it is not
JSON-serializable.

## The emitted code

Nodes become implementation calls, loops become `for`, switches become
`if/else`, groups become nested scoped blocks. Each value is a readable local
variable named from its node + handle (deduped, reserved-word-safe) by
`src/codegen/nameRegistry.ts` › `createNameRegistry`. The pipeline is
`src/codegen/lower.ts` › `lowerModule` (plan → IR) → `src/codegen/printJs.ts` ›
`printSource` (IR → text) → opt-in `ts.transform` passes → Prettier
(`src/codegen/formatSource.ts` › `formatSource`).

Opt-in codegen-v2 features on `emitGraph` (all default off — the export is a
faithful threaded `runGraph` unless enabled):

- **Auto-emit** (`analyzeImplementations` + `impls`): a self-contained value-API
  impl that reads inputs via the host's `readInput` intrinsic is inlined instead
  of threaded — `src/codegen/analyze/autoEmit.ts` › `deriveAutoEmit`.
- **Dead-code elimination** (`optimize.deadCode` + `assumePureImplementations`):
  `src/codegen/ast/deadCode.ts` › `eliminateDeadCode`.
- **Self-contained artifact** (`emitImplementations: 'source'` +
  `knownFunctions`): bake the consumer's node impls + helper deps into the
  module so `runGraph()` needs no `functionImplementations` argument —
  `src/codegen/analyze/sourceEmit.ts` › `planSourceEmission`.

Per-node inline templates come from `src/codegen/contract.ts` ›
`CodegenMetadata` (`nodeTypeMetadata[id].emit`) supplied to the factory /
`emitJs`.

## The extraction boundary

`src/codegen/contract.ts` is the single file where codegen reaches the host: it
re-exports the runner IR / graph-state types and the executor's classifiers
(`getDataHandleIds`, `findConditionInputId`, `qualifiedId`, `flattenInputs`)
from `@theclearsky/react-blender-nodes/contract`. An ESLint rule forbids every
other `src/codegen/**` file from importing the peer directly. The classifiers
are the executor's OWN functions (re-exported, never duplicated) so the
generated control-flow matches the runtime by construction.

## Type-resolution & the clean-room gate

The build's `scripts/check-dist-types.ts` verifies `dist/index.d.ts` is a
self-contained published bundle (bare externals only). Because the plugin's
public d.ts re-exposes host types (via the run-target contract), a consumer
needs the host's own type dependencies (`@xyflow/react`, `immer`, `zod`) and
`@types/react` present — which any React/TS app using the editor already has. A
dev-time `file:` link resolves the peer from the host's `node_modules`, so a
MISSING plugin-side pin is caught only by a clean-room check: `npm pack` both
packages, install the tarballs into a throwaway dir with no link, then run
`scripts/check-dist-types.ts` against it. See CONTRIBUTING.md.

## Related

- The host library's `docs/runner/runTargetsDoc.md` documents the `RunTarget`
  contract + the `/contract` subpath this plugin consumes.
