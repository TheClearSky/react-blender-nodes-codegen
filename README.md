# @theclearsky/react-blender-nodes-codegen

Codegen plugin for
[`@theclearsky/react-blender-nodes`](https://github.com/TheClearSky/react-blender-nodes).
Compiles a node graph into a standalone, dependency-free `runGraph`
JavaScript/TypeScript module.

It is the codegen half of the editor, split into its own package so the base
library carries no `typescript`/`prettier` weight. It reaches the host library
only through its React-free `@theclearsky/react-blender-nodes/contract` subpath,
so it pulls **no React** at runtime.

## How these projects fit together

```text
                react-blender-nodes  ·  MIT  ·  published
                            T H E   E N G I N E
     ┌────────────────────────────────────────────────────────────┐
     │  A Blender-style node-graph editor for React.              │
     │  Typed handles · validate → plan → apply state · node      │
     │  groups · loops & switches · graph compiler + runner ·     │
     │  import / export                                           │
     └──────┬──────────────────────┬────────────────────────┬─────┘
            │                      │                        │
            │ peerDependency       │ peerDependency         │ file:
            │ >=0.0.14 <1          │ >=0.0.14 <1            │ dependency
            │                      │ (via /contract —       │
            ▼                      ▼  React-free)           │
  ┌──────────────────────┐  ┌──────────────────────┐        │
  │ …-timeline           │  │ …-codegen            │        │
  │ AGPL-3.0 · published │  │ AGPL-3.0 · published │        │
  ├──────────────────────┤  ├───── this package ───┤        │
  │ Keyframed CURVES and │  │ Compiles a graph into│        │
  │ a transport. A curve │  │ a standalone,        │        │
  │ becomes a live signal│  │ dependency-free      │        │
  │ the running graph    │  │ runGraph module.     │        │
  │ can read.            │  │ No React at runtime. │        │
  └──────────┬───────────┘  └──────────────────────┘        │
             │                                              │
             │ file: dependency                             │
             └───────────────────┬──────────────────────────┘
                                 ▼
     ┌────────────────────────────────────────────────────────────┐
     │  react-blender-nodes-sound  ·  AGPL-3.0  ·  app            │
     │                  T H E   A P P L I C A T I O N             │
     ├────────────────────────────────────────────────────────────┤
     │  Here the nodes ARE the audio graph (Tone.js / Web Audio): │
     │  draw a waveform and hear it · gate-driven envelopes ·     │
     │  16-key polyphony · timeline curves automating any         │
     │  parameter while it plays · a spectrally-modelled          │
     │  instrument library                                        │
     └────────────────────────────────────────────────────────────┘
```

An arrow points from a package **to the package that depends on it**. The two
plugins never import each other, and this one deliberately stays out of the
React tree — it is the only sibling that can run headless.

## Install

```bash
npm i @theclearsky/react-blender-nodes-codegen
```

`@theclearsky/react-blender-nodes` (>= 0.0.14) is a **peer** dependency.

## Use it as a run target

```tsx
import { FullGraph } from '@theclearsky/react-blender-nodes';
import {
  codegenJsRunTarget,
  codegenTsRunTarget,
} from '@theclearsky/react-blender-nodes-codegen';

<FullGraph
  state={state}
  dispatch={dispatch}
  functionImplementations={implementations}
  runTargets={[codegenJsRunTarget, codegenTsRunTarget]}
/>;
```

The targets appear in the runner's split **Run** button; picking one emits and
downloads a standalone module.

## Or emit programmatically

```ts
import { emitGraph } from '@theclearsky/react-blender-nodes-codegen';

const source = await emitGraph(plan, state, { target: 'javascript' });
```

Opt-in codegen-v2 features (auto-emit, dead-code elimination, self-contained
`emitImplementations: 'source'`) are documented in
[docs/codegenDoc.md](./docs/codegenDoc.md).

## Live demo

The interactive **CodegenStudio** is this package's own Storybook (it pairs the
host's editor canvas with a live-updating code panel): `npm run storybook`
locally, or the GitHub Pages deployment that the host library's Storybook embeds
by URL. There is also a headless Node demo:

```bash
npm run build && npm run demo   # prints a generated runGraph()
```

## Docs

- [docs/codegenDoc.md](./docs/codegenDoc.md) — run targets,
  `emitGraph`/`emitJs`, the opt-in passes, the extraction boundary.
- [CONTRIBUTING.md](./CONTRIBUTING.md) — dev setup, gates, and the release
  train.

## License

GNU Affero General Public License v3.0 (`AGPL-3.0-only`) — see
[LICENSE](./LICENSE). Copyright (C) 2025-2026 Deepak Prasad.

Emitted `runGraph` modules embed template code from this package; those portions
remain covered by the AGPL. Commercial/proprietary licensing is available
separately — contact [@TheClearSky](https://github.com/TheClearSky).
