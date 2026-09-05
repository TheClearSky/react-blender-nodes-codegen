import { describe, it, expect } from 'vitest';
import { compile } from '@theclearsky/react-blender-nodes';
import type { FunctionImplementations } from '@theclearsky/react-blender-nodes';
import { readInput } from '@theclearsky/react-blender-nodes/contract';
import { emitGraph } from '@/index';

// The host's compiler resolves a fan-in input handle's `connections[]` in the
// order its edges carry via `data.order` (written by REORDER_INPUT_CONNECTIONS).
// That is the SINGLE point fixing the order for both the executor and codegen;
// the compiler side is pinned in the host's own `reorderedFanInOrder.test.ts`.
// This file pins that the EMITTED body renders the fan-in array in that order.
//
// Fixture: Graph Input (A, B, B_2) → OR Gate (A, B) → Graph Output (Out), where
// the OR Gate's `B` input is a FAN-IN — both root inputs `B` (edge e2) and `B_2`
// (edge e3) wire into `or.B`.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyState = any;
const bit = { dataTypeUniqueId: 'bit' };

function fixture(orderById: Record<string, number> = {}): AnyState {
  function edge(
    id: string,
    source: string,
    sourceHandle: string,
    target: string,
    targetHandle: string,
  ) {
    return {
      id,
      source,
      sourceHandle,
      target,
      targetHandle,
      ...(orderById[id] !== undefined
        ? { data: { order: orderById[id] } }
        : {}),
    };
  }
  return {
    nodes: [
      {
        id: 'gi',
        position: { x: 0, y: 0 },
        data: {
          nodeTypeUniqueId: 'groupInput',
          inputs: [],
          outputs: [
            { id: 'gi_a', name: 'A', dataType: bit },
            { id: 'gi_b', name: 'B', dataType: bit },
            { id: 'gi_b2', name: 'B 2', dataType: bit },
          ],
        },
      },
      {
        id: 'or',
        position: { x: 0, y: 0 },
        data: {
          nodeTypeUniqueId: 'orGate',
          inputs: [
            { id: 'or_a', name: 'A', dataType: bit },
            { id: 'or_b', name: 'B', dataType: bit },
          ],
          outputs: [{ id: 'or_out', name: 'Out', dataType: bit }],
        },
      },
      {
        id: 'go',
        position: { x: 0, y: 0 },
        data: {
          nodeTypeUniqueId: 'groupOutput',
          inputs: [{ id: 'go_out', name: 'Out', dataType: bit }],
          outputs: [],
        },
      },
    ],
    edges: [
      edge('e1', 'gi', 'gi_a', 'or', 'or_a'),
      edge('e2', 'gi', 'gi_b', 'or', 'or_b'),
      edge('e3', 'gi', 'gi_b2', 'or', 'or_b'),
      edge('e4', 'or', 'or_out', 'go', 'go_out'),
    ],
    typeOfNodes: {
      groupInput: {
        name: 'Graph Input',
        inputs: [],
        outputs: [
          { name: 'A', dataType: 'bit' },
          { name: 'B', dataType: 'bit' },
          { name: 'B 2', dataType: 'bit' },
        ],
      },
      orGate: {
        name: 'OR Gate',
        inputs: [
          { name: 'A', dataType: 'bit' },
          { name: 'B', dataType: 'bit' },
        ],
        outputs: [{ name: 'Out', dataType: 'bit' }],
      },
      groupOutput: {
        name: 'Graph Output',
        inputs: [{ name: 'Out', dataType: 'bit' }],
        outputs: [],
      },
    },
    dataTypes: {},
  } as AnyState;
}

// Reads B as the WHOLE fan-in array, so the emitted body renders B's connections
// in resolution order (e.g. `[B, B_2]`).
const ARRAY_OR: FunctionImplementations['orGate'] = (inputs) =>
  new Map([
    [
      'Out',
      Boolean(readInput(inputs, 'A')[0]) ||
        readInput(inputs, 'B').some((value) => Boolean(value)),
    ],
  ]);

const IMPLS = { orGate: ARRAY_OR } as FunctionImplementations;

async function emitFanInBody(
  orderById?: Record<string, number>,
): Promise<string> {
  const state = fixture(orderById);
  const plan = compile(state, IMPLS, { maxLoopIterations: 100 });
  return emitGraph(plan, state, {
    exportRunGraph: false,
    analyzeImplementations: true,
    impls: IMPLS as Readonly<Record<string, (...args: never[]) => unknown>>,
  });
}

describe('codegen — emitted fan-in array reflects data.order', () => {
  it('default order emits [B, B_2]', async () => {
    const source = await emitFanInBody();
    expect(source).toContain('[B, B_2].some((value) => Boolean(value))');
  });

  it('reversed order emits [B_2, B]', async () => {
    const source = await emitFanInBody({ e3: 0, e2: 1 });
    expect(source).toContain('[B_2, B].some((value) => Boolean(value))');
  });
});
