import { describe, it, expect } from 'vitest';
import { compile } from '@theclearsky/react-blender-nodes';
import type { FunctionImplementations } from '@theclearsky/react-blender-nodes';
import { emitJs } from '@/index';

// Root Graph I/O → `runGraph` signature. The host's compiler records the root
// Graph Input / Graph Output pair as `plan.rootInputNodeId` /
// `plan.rootOutputNodeId`; codegen turns the Input's handles into the emitted
// function's PARAMETERS and the Output's handles into its returned-object KEYS.
// The host side of this contract (seeding/collecting `rootInputs` /
// `rootOutputs`) is pinned in the host's own `rootIO.test.ts`; this file pins
// the codegen side. (Parity against the host's in-process `execute` needs the
// executor, which the host does not export — see `_staging/README.md`.)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyState = any;

const node = (id: string, t: string, i: unknown[], o: unknown[]) => ({
  id,
  position: { x: 0, y: 0 },
  data: { nodeTypeUniqueId: t, inputs: i, outputs: o },
});

describe('codegen — root Graph I/O function signature', () => {
  const bit = { dataTypeUniqueId: 'bit' };
  // Graph Input (a, b) → AND Gate (emitCode) → Graph Output (out).
  const state = {
    nodes: [
      node(
        'gi',
        'groupInput',
        [],
        [
          { id: 'gi_a', name: 'a', dataType: bit },
          { id: 'gi_b', name: 'b', dataType: bit },
        ],
      ),
      node(
        'and',
        'andGate',
        [
          { id: 'and_a', name: 'A', dataType: bit },
          { id: 'and_b', name: 'B', dataType: bit },
        ],
        [{ id: 'and_out', name: 'Out', dataType: bit }],
      ),
      node(
        'go',
        'groupOutput',
        [{ id: 'go_out', name: 'out', dataType: bit }],
        [],
      ),
    ],
    edges: [
      {
        id: 'e1',
        source: 'gi',
        sourceHandle: 'gi_a',
        target: 'and',
        targetHandle: 'and_a',
      },
      {
        id: 'e2',
        source: 'gi',
        sourceHandle: 'gi_b',
        target: 'and',
        targetHandle: 'and_b',
      },
      {
        id: 'e3',
        source: 'and',
        sourceHandle: 'and_out',
        target: 'go',
        targetHandle: 'go_out',
      },
    ],
    typeOfNodes: {
      groupInput: { name: 'Graph Input' },
      groupOutput: { name: 'Graph Output' },
      andGate: { name: 'AND Gate' },
    },
    dataTypes: {},
  } as AnyState;
  const andImpl: FunctionImplementations = {
    andGate: (inputs) =>
      new Map([
        [
          'Out',
          Boolean(inputs.get('A')?.connections[0]?.value) &&
            Boolean(inputs.get('B')?.connections[0]?.value),
        ],
      ]),
  };
  const metadata = {
    nodeTypeMetadata: {
      andGate: {
        emit: ({ inputs }: { inputs: Record<string, string> }) => ({
          Out: `Boolean(${inputs.A}) && Boolean(${inputs.B})`,
        }),
      },
    },
  };

  it('emits a clean `function runGraph(a, b)` (no impls/async) for an emitCode graph', () => {
    const plan = compile(state, andImpl, { maxLoopIterations: 100 });
    const source = emitJs(plan, state, { metadata, exportRunGraph: false });
    // Graph Input handles are the parameters; no functionImplementations / async.
    expect(source).toContain('function runGraph(a, b) {');
    expect(source).not.toContain('functionImplementations');
    expect(source).not.toContain('async function runGraph');
    // The emitCode gate reads the parameters directly.
    expect(source).toContain('Boolean(a) && Boolean(b)');
    // The return is the Graph Output handle, keyed by name.
    expect(source).toContain('return { "out":');
  });

  it('the emitted runGraph(a, b) runs and returns the Graph Output keyed by name', () => {
    const plan = compile(state, andImpl, { maxLoopIterations: 100 });
    const source = emitJs(plan, state, { metadata, exportRunGraph: false });
    const runGraph = new Function(`${source}\nreturn runGraph;`)() as (
      a: boolean,
      b: boolean,
    ) => Record<string, unknown>;
    expect(runGraph(true, true)).toEqual({ out: true });
    expect(runGraph(true, false)).toEqual({ out: false });
  });
});
