# Documentation — `@theclearsky/react-blender-nodes-codegen`

The codegen plugin for
[`@theclearsky/react-blender-nodes`](https://github.com/TheClearSky/react-blender-nodes).

## What to read

| You want to…                    | Read                                         |
| ------------------------------- | -------------------------------------------- |
| Use the run targets / emit code | [codegenDoc.md](./codegenDoc.md)             |
| Contribute / build / release    | [../CONTRIBUTING.md](../CONTRIBUTING.md)     |
| Match the code style            | [codingGuidelines.md](./codingGuidelines.md) |

## Source map

- `src/index.ts` — the public barrel (`emitGraph`, `emitJs`, the run-target
  factory + built-ins, option/metadata types).
- `src/codegen/` — the emitter internals (lower → IR → print → passes →
  prettier). `src/codegen/contract.ts` is the single boundary to the host
  library.
- `src/codegenRunTarget.ts` — the `artifact` run-target factory + the two
  built-ins.
- `demo/` — a headless Node demo (`emit-demo.mjs`) proving the plugin runs with
  no React present.
