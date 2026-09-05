// A minimal hand-built { plan, state } pair: Src (Out = 4) → Tripler (Out = 3 × In).
//
// An `ExecutionPlan` uses real `Map`s (`inputResolutionMap` / `outputDistributionMap`),
// which JSON cannot represent — hence this is a `.mjs` module, not a `.json` file.
// In a real app the plan comes from the editor's `compile(state)`; a plugin consumer
// receives it via the run-target `context.executionPlan`.

export const plan = {
  levels: [
    [
      {
        kind: 'standard',
        nodeId: 'a',
        nodeTypeId: 'src',
        nodeTypeName: 'Src',
        concurrencyLevel: 0,
      },
    ],
    [
      {
        kind: 'standard',
        nodeId: 'b',
        nodeTypeId: 'tripler',
        nodeTypeName: 'Tripler',
        concurrencyLevel: 1,
      },
    ],
  ],
  inputResolutionMap: new Map([
    ['b:b_in', [{ edgeId: 'e', sourceNodeId: 'a', sourceHandleId: 'a_out' }]],
  ]),
  outputDistributionMap: new Map(),
  nodeCount: 2,
  warnings: [],
};

const number = { dataTypeUniqueId: 'number' };

export const state = {
  nodes: [
    {
      id: 'a',
      position: { x: 0, y: 0 },
      data: {
        nodeTypeUniqueId: 'src',
        inputs: [],
        outputs: [{ id: 'a_out', name: 'Out', dataType: number }],
      },
    },
    {
      id: 'b',
      position: { x: 0, y: 0 },
      data: {
        nodeTypeUniqueId: 'tripler',
        inputs: [{ id: 'b_in', name: 'In', dataType: number }],
        outputs: [{ id: 'b_out', name: 'Out', dataType: number }],
      },
    },
  ],
  edges: [],
  typeOfNodes: { src: { name: 'Src' }, tripler: { name: 'Tripler' } },
  dataTypes: {},
};
