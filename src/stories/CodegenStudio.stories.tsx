import { useEffect, useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import Editor from '@monaco-editor/react';
import {
  FullGraph,
  useFullGraph,
  compile,
  serializeExecutionPlan,
  readInput,
  makeStateWithAutoInfer,
  makeDataTypeWithAutoInfer,
  makeTypeOfNodeWithAutoInfer,
  makeFunctionImplementationsWithAutoInfer,
  standardDataTypes,
  standardNodeTypes,
  standardNodeCountConstraints,
  handleShapesMap,
  jsonIrRunTarget,
  mainReducer,
  actionTypesMap,
} from '@theclearsky/react-blender-nodes';
import type {
  Action,
  FunctionImplementations,
} from '@theclearsky/react-blender-nodes';
import { emitGraph, emitJs, makeCodegenRunTarget } from '@/index';
import type { CodegenMetadata } from '@/index';

// The per-handle input value a function implementation receives. The host
// reaches it from the public `FunctionImplementations` signature but does not
// export the type itself (a host follow-up), so derive it from that signature
// rather than redeclaring a shape that could drift.
type InputHandleValue = NonNullable<
  ReturnType<Parameters<NonNullable<FunctionImplementations[string]>>[0]['get']>
>;

// The CodegenStudio: build a logic-circuit graph with the host's FullGraph and
// watch this plugin emit a standalone, dependency-free `runGraph` live. These
// stories moved here from the host library's Storybook so the MIT host never
// depends on this AGPL package; the host's Storybook embeds them from this
// repo's GitHub Pages by URL.

const meta: Meta<typeof FullGraph> = {
  title: 'Codegen Studio',
  component: FullGraph,
  parameters: { layout: 'fullscreen' },
};
export default meta;

// ─── Circuit fixtures (a copy of the host Storybook's; the host keeps its own) ───

const circuitExampleDataTypes = {
  bit: makeDataTypeWithAutoInfer({
    name: 'Bit',
    underlyingType: 'boolean',
    color: '#00BFFF',
    shape: handleShapesMap.rectangle,
    allowInput: true,
  }),
  number: makeDataTypeWithAutoInfer({
    name: 'Number',
    underlyingType: 'number',
    color: '#FF6B6B',
    shape: handleShapesMap.circle,
    allowInput: true,
  }),
  gateMode: makeDataTypeWithAutoInfer({
    name: 'Gate Mode',
    underlyingType: 'string',
    color: '#FECA57',
    allowInput: true,
    allowedStrings: ['AND', 'OR', 'XOR', 'NAND', 'NOR', 'XNOR'],
  }),
  ...standardDataTypes,
} as const;

type CircuitDataTypeId = keyof typeof circuitExampleDataTypes;

const circuitExampleTypeOfNodes = {
  andGate: makeTypeOfNodeWithAutoInfer<CircuitDataTypeId, 'andGate'>({
    name: 'AND Gate',
    headerColor: '#8B5CC8',
    locationInContextMenu: ['Logic Gates'],
    inputs: [
      { name: 'A', dataType: 'bit' },
      { name: 'B', dataType: 'bit' },
    ],
    outputs: [{ name: 'Out', dataType: 'bit' }],
  }),
  orGate: makeTypeOfNodeWithAutoInfer<CircuitDataTypeId, 'orGate'>({
    name: 'OR Gate',
    headerColor: '#8B5CC8',
    locationInContextMenu: ['Logic Gates'],
    inputs: [
      { name: 'A', dataType: 'bit' },
      { name: 'B', dataType: 'bit' },
    ],
    outputs: [{ name: 'Out', dataType: 'bit' }],
  }),
  notGate: makeTypeOfNodeWithAutoInfer<CircuitDataTypeId, 'notGate'>({
    name: 'NOT Gate',
    headerColor: '#8B5CC8',
    locationInContextMenu: ['Logic Gates'],
    inputs: [{ name: 'In', dataType: 'bit' }],
    outputs: [{ name: 'Out', dataType: 'bit' }],
  }),
  xorGate: makeTypeOfNodeWithAutoInfer<CircuitDataTypeId, 'xorGate'>({
    name: 'XOR Gate',
    headerColor: '#8B5CC8',
    locationInContextMenu: ['Logic Gates'],
    inputs: [
      { name: 'A', dataType: 'bit' },
      { name: 'B', dataType: 'bit' },
    ],
    outputs: [{ name: 'Out', dataType: 'bit' }],
  }),
  nandGate: makeTypeOfNodeWithAutoInfer<CircuitDataTypeId, 'nandGate'>({
    name: 'NAND Gate',
    headerColor: '#8B5CC8',
    locationInContextMenu: ['Logic Gates'],
    inputs: [
      { name: 'A', dataType: 'bit' },
      { name: 'B', dataType: 'bit' },
    ],
    outputs: [{ name: 'Out', dataType: 'bit' }],
  }),
  norGate: makeTypeOfNodeWithAutoInfer<CircuitDataTypeId, 'norGate'>({
    name: 'NOR Gate',
    headerColor: '#8B5CC8',
    locationInContextMenu: ['Logic Gates'],
    inputs: [
      { name: 'A', dataType: 'bit' },
      { name: 'B', dataType: 'bit' },
    ],
    outputs: [{ name: 'Out', dataType: 'bit' }],
  }),
  buffer: makeTypeOfNodeWithAutoInfer<CircuitDataTypeId, 'buffer'>({
    name: 'Buffer',
    headerColor: '#9B0F2B',
    locationInContextMenu: ['Utility'],
    inputs: [{ name: 'In', dataType: 'bit' }],
    outputs: [{ name: 'Out', dataType: 'bit' }],
  }),
  // A genuine fan-in consumer: a SINGLE `In` handle (left unbounded so it accepts
  // multiple edges) that ORs together every connected bit. Its impl reads the
  // WHOLE `readInput(inputs, 'In')` array, so under fan-in codegen renders it as
  // the array form `[a, b, …].some(…)` instead of dropping all but the first.
  anyOf: makeTypeOfNodeWithAutoInfer<CircuitDataTypeId, 'anyOf'>({
    name: 'Any Of (bus OR)',
    headerColor: '#8B5CC8',
    locationInContextMenu: ['Logic Gates'],
    inputs: [{ name: 'In', dataType: 'bit' }],
    outputs: [{ name: 'Out', dataType: 'bit' }],
  }),
  bitConstant: makeTypeOfNodeWithAutoInfer<CircuitDataTypeId, 'bitConstant'>({
    name: 'Bit Input',
    headerColor: '#C75B8E',
    locationInContextMenu: ['I/O'],
    inputs: [{ name: 'Value', dataType: 'bit', allowInput: true }],
    outputs: [{ name: 'Out', dataType: 'bit' }],
  }),
  bitDisplay: makeTypeOfNodeWithAutoInfer<CircuitDataTypeId, 'bitDisplay'>({
    name: 'Bit Output',
    headerColor: '#4A96BA',
    locationInContextMenu: ['I/O'],
    inputs: [{ name: 'In', dataType: 'bit' }],
    outputs: [],
  }),
  // Numeric graph I/O — needed by the loop-counter demo: a loop's carry channel
  // is strictly single-typed, so a NUMERIC count must be seeded/displayed by
  // number nodes (a bit source/sink would make the carry type-inconsistent).
  numberConstant: makeTypeOfNodeWithAutoInfer<
    CircuitDataTypeId,
    'numberConstant'
  >({
    name: 'Number Input',
    headerColor: '#C75B8E',
    locationInContextMenu: ['I/O'],
    inputs: [{ name: 'Value', dataType: 'number', allowInput: true }],
    outputs: [{ name: 'Out', dataType: 'number' }],
  }),
  numberDisplay: makeTypeOfNodeWithAutoInfer<
    CircuitDataTypeId,
    'numberDisplay'
  >({
    name: 'Number Output',
    headerColor: '#4A96BA',
    locationInContextMenu: ['I/O'],
    inputs: [{ name: 'In', dataType: 'number' }],
    outputs: [],
  }),
  counter: makeTypeOfNodeWithAutoInfer<CircuitDataTypeId, 'counter'>({
    name: 'Counter',
    headerColor: '#9B0F2B',
    locationInContextMenu: ['Utility'],
    inputs: [
      { name: 'Count', dataType: 'number', allowInput: true },
      { name: 'Max', dataType: 'number', allowInput: true },
    ],
    outputs: [
      { name: 'Count + 1', dataType: 'number' },
      { name: 'Reached Max', dataType: 'bit' },
    ],
  }),
  configurableGate: makeTypeOfNodeWithAutoInfer<
    CircuitDataTypeId,
    'configurableGate'
  >({
    name: 'Configurable Gate',
    headerColor: '#6B5B95',
    locationInContextMenu: ['Logic Gates'],
    inputs: [
      { name: 'A', dataType: 'bit' },
      { name: 'B', dataType: 'bit' },
      { name: 'Mode', dataType: 'gateMode', allowInput: true },
    ],
    outputs: [{ name: 'Out', dataType: 'bit' }],
  }),
  ...standardNodeTypes,
} as const;

type CircuitNodeTypeId = keyof typeof circuitExampleTypeOfNodes;

// Codegen metadata (Decision 6) — dataType→TS types live HERE, passed to the
// codegen factory / emitJs, not on the core TypeOfNode / DataType. No authored
// `emit` hooks: every inlinable node reads its inputs via the recognized
// `readInput` intrinsic and is AUTO-EMITTED from its implementation
// (`analyzeImplementations`), so the impl is the single source of truth. Nodes
// that can't be auto-derived (e.g. `configurableGate`, the displays) thread.
const circuitCodegenMetadata: CodegenMetadata = {
  dataTypeToTsType: {
    bit: 'boolean',
    number: 'number',
    gateMode: "'AND' | 'OR' | 'XOR' | 'NAND' | 'NOR' | 'XNOR'",
  },
};

/**
 * Extract the first connection value from an input handle,
 * falling back to the user-entered default, then to a provided fallback.
 */
function getFirstInputVal(
  handle: InputHandleValue | undefined,
  fallback: unknown = undefined,
): unknown {
  if (!handle) return fallback;
  if (handle.connections.length > 0) return handle.connections[0].value;
  if (handle.isDefault) return handle.defaultValue;
  return fallback;
}

const circuitImplementations =
  makeFunctionImplementationsWithAutoInfer<CircuitNodeTypeId>({
    // Every gate reads its inputs via the recognized `readInput(...)[0]` intrinsic
    // and returns a SINGLE pure expression, so `analyzeImplementations` AUTO-EMITS
    // them inline — no authored `emit` hook needed (the impl is the single source
    // of truth). A fan-in input renders as its first connection (value-identical to
    // this `[0]` read); see `anyOf` for the whole-array form.
    andGate: (inputs) =>
      new Map([
        [
          'Out',
          Boolean(readInput(inputs, 'A')[0]) &&
            Boolean(readInput(inputs, 'B')[0]),
        ],
      ]),
    orGate: (inputs) =>
      new Map([
        [
          'Out',
          Boolean(readInput(inputs, 'A')[0]) ||
            Boolean(readInput(inputs, 'B')[0]),
        ],
      ]),
    // `!` already coerces to boolean, so no `Boolean(...)` wrapper (which would
    // be a redundant cast lint flags); codegen renders `!In`.
    notGate: (inputs) => new Map([['Out', !readInput(inputs, 'In')[0]]]),
    xorGate: (inputs) =>
      new Map([
        [
          'Out',
          Boolean(readInput(inputs, 'A')[0]) !==
            Boolean(readInput(inputs, 'B')[0]),
        ],
      ]),
    nandGate: (inputs) =>
      new Map([
        [
          'Out',
          !(
            Boolean(readInput(inputs, 'A')[0]) &&
            Boolean(readInput(inputs, 'B')[0])
          ),
        ],
      ]),
    norGate: (inputs) =>
      new Map([
        [
          'Out',
          !(
            Boolean(readInput(inputs, 'A')[0]) ||
            Boolean(readInput(inputs, 'B')[0])
          ),
        ],
      ]),
    buffer: (inputs) => new Map([['Out', Boolean(readInput(inputs, 'In')[0])]]),
    // Reads the WHOLE `In` fan-in array (no `[0]`) and ORs every connection. No
    // authored `emit` hook, so `analyzeImplementations` AUTO-DERIVES it; under a
    // fan-in codegen renders the input as the array `[a, b, …].some(…)` (the
    // "uses both" form) instead of dropping all but the first connection.
    anyOf: (inputs) =>
      new Map([
        ['Out', readInput(inputs, 'In').some((value) => Boolean(value))],
      ]),
    // Reads its input through the `readInput` intrinsic + only the `Boolean`
    // global ⇒ self-contained ⇒ AUTO-EMITS inline (no `emit` hook) when
    // `analyzeImplementations` is on, instead of threading.
    bitConstant: (inputs) =>
      new Map([['Out', Boolean(readInput(inputs, 'Value')[0])]]),
    bitDisplay: () => {
      return new Map();
    },
    numberConstant: (inputs) =>
      new Map([['Out', Number(readInput(inputs, 'Value')[0])]]),
    numberDisplay: () => {
      return new Map();
    },
    counter: (inputs) => {
      const count = Number(getFirstInputVal(inputs.get('Count'), 0));
      const max = Number(getFirstInputVal(inputs.get('Max'), 10));
      return new Map<string, unknown>([
        ['Count + 1', count + 1],
        ['Reached Max', count + 1 >= max],
      ]);
    },
    configurableGate: (inputs) => {
      const a = Boolean(getFirstInputVal(inputs.get('A'), false));
      const b = Boolean(getFirstInputVal(inputs.get('B'), false));
      const mode = String(getFirstInputVal(inputs.get('Mode'), 'AND'));
      const operations: Record<string, (x: boolean, y: boolean) => boolean> = {
        AND: (x, y) => x && y,
        OR: (x, y) => x || y,
        XOR: (x, y) => x !== y,
        NAND: (x, y) => !(x && y),
        NOR: (x, y) => !(x || y),
        XNOR: (x, y) => x === y,
      };
      const operation = operations[mode] ?? operations['AND'];
      return new Map([['Out', operation(a, b)]]);
    },
  });

// Codegen run targets carrying the circuit's metadata + impls (shared by the
// codegen stories). `analyzeImplementations` derives inline `emit` hooks from the
// `readInput`-based implementations above, so the gates inline without authored
// hooks. Defined AFTER `circuitImplementations` so they can reference it.
const circuitCodegenJsRunTarget = makeCodegenRunTarget({
  metadata: circuitCodegenMetadata,
  analyzeImplementations: true,
  impls: circuitImplementations as Readonly<
    Record<string, (...args: never[]) => unknown>
  >,
});
const circuitCodegenTsRunTarget = makeCodegenRunTarget({
  target: 'typescript',
  metadata: circuitCodegenMetadata,
  analyzeImplementations: true,
  impls: circuitImplementations as Readonly<
    Record<string, (...args: never[]) => unknown>
  >,
});

// ─── The studio ───

/**
 * Side-by-side studio: build a logic-circuit graph on the left (it starts
 * empty — right-click the canvas to add Bit Inputs and gates), and watch the
 * `codegen-js` run target emit a standalone, dependency-free JavaScript
 * `runGraph` on the right, live, in a Monaco editor with full JS syntax
 * highlighting. Bit Input defaults (and unconnected gate inputs) are baked into
 * the generated code; press Run to evaluate it and see the output. Switch to
 * `json-ir` to view the compiled plan as JSON instead.
 */
// Derive the exact node/edge types `useFullGraph<Circuit…>` expects for its
// initial state (the `Nodes` generic's parameter ORDER differs from the usual
// convention, so deriving avoids getting it wrong).
type CircuitInitialState = Parameters<
  typeof useFullGraph<CircuitDataTypeId, CircuitNodeTypeId>
>[0];

type CodegenStudioViewProps = {
  initialNodes: CircuitInitialState['nodes'];
  initialEdges: CircuitInitialState['edges'];
  /** Start with the `self-contained` toggle on (`emitImplementations: 'source'`). */
  initialSelfContained?: boolean;
  /** Start with the `optimize` (DCE) toggle in this state. Default on; pass `false`
   *  for the self-contained demo so the baked output-node defs aren't pruned. */
  initialOptimize?: boolean;
};

/**
 * The shared CodegenStudio canvas + live-codegen panel. Driven by an initial
 * node/edge set so it can start either empty (build from scratch) or with a
 * declared Graph Input → … → Graph Output pipeline that emits `runGraph(a, b)`.
 * Toolbar toggles: output format, `optimize` (dead-code elimination),
 * `self-contained` (`emitImplementations: 'source'` — bake the impls so
 * `runGraph()` needs no `functionImplementations` arg; see `CodegenSelfContained`),
 * and `lock root I/O` (freezes the `runGraph` signature — `allowRootIORename` /
 * `allowRootIOStructureEdit` off, so connecting concretizes the TYPE only and the
 * Graph I/O editor's rename/add/delete affordances disable in lockstep).
 */
function CodegenStudioView({
  initialNodes,
  initialEdges,
  initialSelfContained,
  initialOptimize,
}: CodegenStudioViewProps) {
  const { state, dispatch } = useFullGraph<
    CircuitDataTypeId,
    CircuitNodeTypeId
  >({
    dataTypes: circuitExampleDataTypes,
    typeOfNodes: circuitExampleTypeOfNodes,
    nodes: initialNodes,
    edges: initialEdges,
    allowedConversionsBetweenDataTypes: {
      bit: { condition: true },
      condition: { bit: true },
    },
    allowConversionBetweenComplexTypesUnlessDisallowedByComplexTypeChecking: true,
    enableComplexTypeChecking: true,
    enableTypeInference: true,
    enableCycleChecking: true,
    enableRecursionChecking: true,
    nodeCountConstraints: standardNodeCountConstraints,
  });

  const [format, setFormat] = useState<'codegen-js' | 'codegen-ts' | 'json-ir'>(
    'codegen-js',
  );
  // Opt-in optimization passes (codegen v2 Stage 4). Dead-code elimination drops
  // graph branches no Graph Output depends on; needs the pure-impl assumption to
  // prune threaded impl-call nodes.
  const [optimize, setOptimize] = useState(initialOptimize ?? true);
  // Bake the impls + helpers into the module (`emitImplementations: 'source'`) so
  // the emitted `runGraph()` runs with no `functionImplementations` argument —
  // covered nodes inline/source-emit, uncovered ones thread with a `// warning:`.
  const [selfContained, setSelfContained] = useState(
    initialSelfContained ?? false,
  );
  // Freeze the root I/O contract — connecting concretizes the type but does NOT
  // rename the handle or grow a spare, and the Graph I/O editor locks in step.
  const [lockRootIO, setLockRootIO] = useState(false);
  const [code, setCode] = useState('');
  const [output, setOutput] = useState('');

  // Live-regenerate whenever the graph (or chosen format) changes. Codegen is
  // Prettier-formatted (async) for a presentable preview.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // Concrete matching generics (state and impls share N) — no widening
        // needed; U/C take their defaults.
        const plan = compile<CircuitDataTypeId, CircuitNodeTypeId>(
          state,
          circuitImplementations,
          { maxLoopIterations: 100 },
        );
        let next: string;
        if (format === 'json-ir') {
          next = JSON.stringify(serializeExecutionPlan(plan), null, 2);
        } else {
          const language =
            format === 'codegen-ts' ? 'typescript' : 'javascript';
          next = await emitGraph<CircuitDataTypeId, CircuitNodeTypeId>(
            plan,
            state,
            {
              metadata: circuitCodegenMetadata,
              target: language,
              optimize: { deadCode: optimize },
              assumePureImplementations: optimize,
              ...(selfContained
                ? {
                    emitImplementations: 'source' as const,
                    knownFunctions: {
                      ...circuitImplementations,
                      getFirstInputVal,
                    } as Readonly<
                      Record<string, (...args: never[]) => unknown>
                    >,
                  }
                : {
                    analyzeImplementations: optimize,
                    impls: circuitImplementations as Readonly<
                      Record<string, (...args: never[]) => unknown>
                    >,
                  }),
            },
          );
        }
        if (!cancelled) setCode(next);
      } catch (error) {
        if (!cancelled)
          setCode(
            `// Could not generate code from the current graph:\n// ${String(error)}`,
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state, format, optimize, selfContained]);

  const runGeneratedCode = () => {
    if (format !== 'codegen-js') {
      setOutput('Switch to "codegen-js" to run the generated function.');
      return;
    }
    void (async () => {
      try {
        const runnable = code.replace(/export\s*\{[^}]*\};?\s*$/, '');
        const runGraph = new Function(`${runnable}\nreturn runGraph;`)() as (
          ...args: unknown[]
        ) => unknown | Promise<unknown>;
        // The signature varies — root Graph I/O ⇒ `runGraph(a, b)`; threaded ⇒
        // `runGraph(functionImplementations, …)`. Map each parameter by name:
        // impls/options get the real values; declared graph inputs get a sample
        // boolean (`true`) so the demo Run shows a concrete result.
        const source = runGraph.toString();
        const params = source
          .slice(source.indexOf('(') + 1, source.indexOf(')'))
          .split(',')
          .map((p) => p.trim().split('=')[0].trim())
          .filter(Boolean);
        const args = params.map((name) =>
          name === 'functionImplementations'
            ? circuitImplementations
            : name === 'options'
              ? {}
              : true,
        );
        const values = (await runGraph(...args)) as Record<string, unknown>;
        setOutput(
          Object.keys(values).length === 0
            ? '{}\n// Build a circuit on the left, then Run.'
            : JSON.stringify(values, null, 2),
        );
      } catch (error) {
        setOutput(`Error: ${String(error)}`);
      }
    })();
  };

  return (
    <div style={{ height: '100vh', display: 'flex' }}>
      <div style={{ flex: 1, minWidth: 0, borderRight: '1px solid #3f3f46' }}>
        <FullGraph<CircuitDataTypeId, CircuitNodeTypeId>
          state={state}
          dispatch={dispatch}
          functionImplementations={circuitImplementations}
          runTargets={[
            circuitCodegenJsRunTarget,
            circuitCodegenTsRunTarget,
            jsonIrRunTarget,
          ]}
          allowRootIORename={!lockRootIO}
          allowRootIOStructureEdit={!lockRootIO}
        />
      </div>
      <div
        style={{
          width: '46%',
          display: 'flex',
          flexDirection: 'column',
          background: '#1e1e1e',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            background: '#27272a',
            color: '#e4e4e7',
            fontSize: 13,
          }}
        >
          <strong style={{ marginRight: 'auto' }}>
            Generated live from the graph →
          </strong>
          <select
            value={format}
            onChange={(event) =>
              setFormat(
                event.target.value as 'codegen-js' | 'codegen-ts' | 'json-ir',
              )
            }
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid #71717a',
              background: '#18181b',
              color: '#e4e4e7',
              cursor: 'pointer',
            }}
          >
            <option value='codegen-js'>codegen-js (standalone JS)</option>
            <option value='codegen-ts'>codegen-ts (typed TS)</option>
            <option value='json-ir'>json-ir (plan JSON)</option>
          </select>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              cursor: format === 'json-ir' ? 'not-allowed' : 'pointer',
              opacity: format === 'json-ir' ? 0.5 : 1,
            }}
            title='Dead-code elimination: drop branches no Graph Output depends on (assumes pure impls)'
          >
            <input
              type='checkbox'
              checked={optimize}
              disabled={format === 'json-ir'}
              onChange={(event) => setOptimize(event.target.checked)}
            />
            optimize
          </label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              cursor: format === 'json-ir' ? 'not-allowed' : 'pointer',
              opacity: format === 'json-ir' ? 0.5 : 1,
            }}
            title='emitImplementations: source — bake the node impls + helpers into the module so runGraph() needs no functionImplementations argument (graceful mixed: uncovered nodes thread with a // warning).'
          >
            <input
              type='checkbox'
              checked={selfContained}
              disabled={format === 'json-ir'}
              onChange={(event) => setSelfContained(event.target.checked)}
            />
            self-contained
          </label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              cursor: 'pointer',
            }}
            title='Lock the root I/O contract: connecting concretizes the type but does NOT rename the handle or grow a spare, and the Graph I/O editor rename/add/delete disable in lockstep (allowRootIORename / allowRootIOStructureEdit off).'
          >
            <input
              type='checkbox'
              checked={lockRootIO}
              onChange={(event) => setLockRootIO(event.target.checked)}
            />
            lock root I/O
          </label>
          <button
            type='button'
            onClick={runGeneratedCode}
            disabled={format !== 'codegen-js'}
            style={{
              padding: '4px 14px',
              borderRadius: 6,
              border: 'none',
              background: format === 'codegen-js' ? '#2563eb' : '#3f3f46',
              color: 'white',
              cursor: format === 'codegen-js' ? 'pointer' : 'not-allowed',
              fontWeight: 600,
            }}
          >
            ▶ Run
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <Editor
            height='100%'
            language={
              format === 'codegen-js'
                ? 'javascript'
                : format === 'codegen-ts'
                  ? 'typescript'
                  : 'json'
            }
            theme='vs-dark'
            value={code}
            onChange={(value) => setCode(value ?? '')}
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
            }}
          />
        </div>
        {output && (
          <div
            style={{
              maxHeight: '30%',
              overflow: 'auto',
              borderTop: '1px solid #3f3f46',
              padding: '8px 12px',
              color: '#a7f3d0',
              background: '#0b0b0b',
              fontFamily: 'monospace',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
            }}
          >
            <strong style={{ color: '#e4e4e7' }}>
              Output (runGraph result):
            </strong>
            {`\n${output}`}
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Declared root Graph I/O — the graph's I/O boundary is pre-built so the
// codegen panel shows `function runGraph(a, b)` out of the box (E5 demo).
//   Graph Input (a, b) → AND Gate → Graph Output (out)   [live]
//   Bit Input → OR Gate → (nothing)                       [dead]
// The dead branch lets the `optimize` toggle (dead-code elimination) show its
// effect: ON drops it (clean sync `runGraph(a, b)`), OFF keeps it (the threaded
// Bit Input forces `async`/`functionImplementations`). Edit the boundary handles
// via the Graph Input/Output node's pencil, or add a new one at root via the
// canvas context menu ("Add Graph Input/Output").
// ────────────────────────────────────────────────────────────────────────

function buildGraphIoCircuit() {
  // Build the demo graph the way a USER would — by dispatching reducer actions
  // onto an EMPTY graph — instead of hand-constructing nodes / handles / edges.
  let state = makeStateWithAutoInfer<CircuitDataTypeId, CircuitNodeTypeId>({
    dataTypes: circuitExampleDataTypes,
    typeOfNodes: circuitExampleTypeOfNodes,
    nodes: [],
    edges: [],
    // Inference concretizes the named Graph I/O handles to `bit` when wired.
    enableTypeInference: true,
  });
  const dispatch = (
    action: Action<CircuitDataTypeId, CircuitNodeTypeId>,
  ): void => {
    state = mainReducer<CircuitDataTypeId, CircuitNodeTypeId>(state, action);
  };

  // ADD_NODE mints a random id — recover it as the node not present beforehand.
  const addNode = (
    type: CircuitNodeTypeId,
    position: { x: number; y: number },
  ): string => {
    const before = new Set(state.nodes.map((node) => node.id));
    dispatch({ type: actionTypesMap.ADD_NODE, payload: { type, position } });
    const added = state.nodes.find((node) => !before.has(node.id));
    if (!added) throw new Error(`ADD_NODE(${type}) added no node`);
    return added.id;
  };

  // Look up a leaf handle id by NAME on a node (defensively unwrapping panels).
  const handleId = (
    nodeId: string,
    side: 'inputs' | 'outputs',
    name: string,
  ): string => {
    const node = state.nodes.find((candidate) => candidate.id === nodeId);
    const leaves = (node?.data[side] ?? []).flatMap((handle) =>
      'inputs' in handle ? handle.inputs : [handle],
    );
    const handle = leaves.find((leaf) => leaf.name === name);
    if (!handle) {
      throw new Error(`handle "${name}" not found on ${nodeId}.${side}`);
    }
    return handle.id;
  };

  // The current blank "+ slot" infer template (the unnamed `groupInfer` handle a
  // boundary node carries / regrows). Auto-grow consumes it and grows a new one,
  // so re-query before every connect.
  const blankHandleId = (
    nodeId: string,
    side: 'inputs' | 'outputs',
  ): string => {
    const node = state.nodes.find((candidate) => candidate.id === nodeId);
    const leaves = (node?.data[side] ?? []).flatMap((handle) =>
      'inputs' in handle ? handle.inputs : [handle],
    );
    const blank = leaves.find((leaf) => leaf.name === '');
    if (!blank) throw new Error(`no blank "+ slot" on ${nodeId}.${side}`);
    return blank.id;
  };

  // 1. Place the five nodes (positions mirror the original layout). A LIVE Bit
  //    Input feeds a second Graph Output; a DEAD OR gate (output wired to
  //    nothing) gives dead-code elimination something to drop.
  const graphInputId = addNode('groupInput', { x: 0, y: 120 });
  const andGateId = addNode('andGate', { x: 480, y: 140 });
  const graphOutputId = addNode('groupOutput', { x: 960, y: 180 });
  const bitInputId = addNode('bitConstant', { x: 0, y: 430 });
  const deadOrId = addNode('orGate', { x: 480, y: 430 });

  // 2. Bake the Bit Input's value so it inlines as the constant `true`. A boolean
  //    input carries its value through the `string | number` payload via the same
  //    cast `ContextAwareInput` uses for its checkbox.
  dispatch({
    type: actionTypesMap.UPDATE_INPUT_VALUE,
    payload: {
      nodeId: bitInputId,
      inputId: handleId(bitInputId, 'inputs', 'Value'),
      value: true as unknown as number,
    },
  });

  // 3. Wire it up exactly the way the canvas does — by connecting to the blank
  //    "+ slot" infer template each boundary node carries. Every such connect
  //    auto-NAMES the new root handle after the gate handle it meets, concretizes
  //    it to `bit`, and grows a FRESH blank for the next one. Auto-grow keeps a
  //    single infer handle live at a time, which is what preserves the "+ slot" as
  //    a real `groupInfer` template: naming every handle up front (via
  //    UPDATE_GRAPH_IO_HANDLES) would leave several `groupInfer` handles
  //    coexisting, and connecting one would concretize them ALL — inference
  //    matches by dataType — corrupting the blank into a `bit`-typed `''` handle.
  const connect = (
    source: string,
    sourceHandle: string,
    target: string,
    targetHandle: string,
  ): void => {
    dispatch({
      type: actionTypesMap.ADD_EDGE_BY_REACT_FLOW,
      payload: { edge: { source, sourceHandle, target, targetHandle } },
    });
  };
  // Graph Input → AND Gate: connect the blank "+ slot" twice → root inputs A, B.
  connect(
    graphInputId,
    blankHandleId(graphInputId, 'outputs'),
    andGateId,
    handleId(andGateId, 'inputs', 'A'),
  );
  connect(
    graphInputId,
    blankHandleId(graphInputId, 'outputs'),
    andGateId,
    handleId(andGateId, 'inputs', 'B'),
  );
  // AND Gate → Graph Output: the live result becomes root output `Out`.
  connect(
    andGateId,
    handleId(andGateId, 'outputs', 'Out'),
    graphOutputId,
    blankHandleId(graphOutputId, 'inputs'),
  );
  // LIVE: Bit Input → Graph Output: a second root output that auto-emits the
  // constant `Boolean(true)` inline when optimized.
  connect(
    bitInputId,
    handleId(bitInputId, 'outputs', 'Out'),
    graphOutputId,
    blankHandleId(graphOutputId, 'inputs'),
  );
  // DEAD: Bit Input → OR gate.A; the OR gate's output goes nowhere → DCE drops it.
  connect(
    bitInputId,
    handleId(bitInputId, 'outputs', 'Out'),
    deadOrId,
    handleId(deadOrId, 'inputs', 'A'),
  );

  return {
    nodes: state.nodes as CircuitInitialState['nodes'],
    edges: state.edges as CircuitInitialState['edges'],
  };
}

// ────────────────────────────────────────────────────────────────────────
// Half-adder demo for `emitImplementations: 'source'` (self-contained codegen):
//
//   Bit Input(A=true) ──┬──> AND Gate ──> Bit Output (Carry)
//   Bit Input(B=true) ──┴──> XOR Gate ──> Bit Output (Sum)
//
// With `self-contained` ON: the gates / bit inputs AUTO-EMIT inline, and the Bit
// Output (`bitDisplay`, a non-kernel `() => new Map()`) SOURCE-EMITS as a baked
// `const bitDisplay = …` (ONE def, called by both display instances) — so the
// emitted `runGraph()` is fully standalone, with no `functionImplementations`
// argument. `optimize` (DCE) starts OFF so the baked output-node calls (which
// produce no returned value) aren't pruned away — toggle it on to watch them go.
// ────────────────────────────────────────────────────────────────────────

function buildSelfContainedDemoCircuit() {
  let state = makeStateWithAutoInfer<CircuitDataTypeId, CircuitNodeTypeId>({
    dataTypes: circuitExampleDataTypes,
    typeOfNodes: circuitExampleTypeOfNodes,
    nodes: [],
    edges: [],
    enableTypeInference: true,
  });
  const dispatch = (
    action: Action<CircuitDataTypeId, CircuitNodeTypeId>,
  ): void => {
    state = mainReducer<CircuitDataTypeId, CircuitNodeTypeId>(state, action);
  };
  const addNode = (
    type: CircuitNodeTypeId,
    position: { x: number; y: number },
  ): string => {
    const before = new Set(state.nodes.map((node) => node.id));
    dispatch({ type: actionTypesMap.ADD_NODE, payload: { type, position } });
    const added = state.nodes.find((node) => !before.has(node.id));
    if (!added) throw new Error(`ADD_NODE(${type}) added no node`);
    return added.id;
  };
  const handleId = (
    nodeId: string,
    side: 'inputs' | 'outputs',
    name: string,
  ): string => {
    const node = state.nodes.find((candidate) => candidate.id === nodeId);
    const leaves = (node?.data[side] ?? []).flatMap((handle) =>
      'inputs' in handle ? handle.inputs : [handle],
    );
    const handle = leaves.find((leaf) => leaf.name === name);
    if (!handle) {
      throw new Error(`handle "${name}" not found on ${nodeId}.${side}`);
    }
    return handle.id;
  };
  const connect = (
    source: string,
    sourceHandle: string,
    target: string,
    targetHandle: string,
  ): void => {
    dispatch({
      type: actionTypesMap.ADD_EDGE_BY_REACT_FLOW,
      payload: { edge: { source, sourceHandle, target, targetHandle } },
    });
  };

  const constA = addNode('bitConstant', { x: 0, y: 80 });
  const constB = addNode('bitConstant', { x: 0, y: 320 });
  const andId = addNode('andGate', { x: 440, y: 120 });
  const xorId = addNode('xorGate', { x: 440, y: 320 });
  const carryId = addNode('bitDisplay', { x: 880, y: 120 });
  const sumId = addNode('bitDisplay', { x: 880, y: 320 });

  const bake = (nodeId: string): void =>
    dispatch({
      type: actionTypesMap.UPDATE_INPUT_VALUE,
      payload: {
        nodeId,
        inputId: handleId(nodeId, 'inputs', 'Value'),
        value: true as unknown as number,
      },
    });
  bake(constA);
  bake(constB);

  connect(
    constA,
    handleId(constA, 'outputs', 'Out'),
    andId,
    handleId(andId, 'inputs', 'A'),
  );
  connect(
    constB,
    handleId(constB, 'outputs', 'Out'),
    andId,
    handleId(andId, 'inputs', 'B'),
  );
  connect(
    constA,
    handleId(constA, 'outputs', 'Out'),
    xorId,
    handleId(xorId, 'inputs', 'A'),
  );
  connect(
    constB,
    handleId(constB, 'outputs', 'Out'),
    xorId,
    handleId(xorId, 'inputs', 'B'),
  );
  connect(
    andId,
    handleId(andId, 'outputs', 'Out'),
    carryId,
    handleId(carryId, 'inputs', 'In'),
  );
  connect(
    xorId,
    handleId(xorId, 'outputs', 'Out'),
    sumId,
    handleId(sumId, 'inputs', 'In'),
  );

  return {
    nodes: state.nodes as CircuitInitialState['nodes'],
    edges: state.edges as CircuitInitialState['edges'],
  };
}

/**
 * The codegen studio: build a circuit on the left, watch the standalone `runGraph`
 * regenerate live on the right. Seeded with root Graph I/O — auto-grown by
 * connecting to each boundary node's blank "+ slot", exactly as the canvas does,
 * so the handles take the gate-derived names `A` / `B` / `Out` — plus a DEAD
 * branch so the toolbar toggles each have something to show:
 * - **format** — `codegen-js` / `codegen-ts` / `json-ir`.
 * - **optimize** (default ON) — dead-code elimination drops the dead
 *   `Bit Input → OR` branch, leaving a clean `function runGraph(A, B)`; OFF keeps
 *   it (the threaded Bit Input drags in `async` + `functionImplementations`).
 * - **lock root I/O** — freezes the `runGraph` signature: connecting concretizes
 *   the TYPE only (no rename, no grown spare), and the Graph I/O editor's
 *   rename/add/delete disable in lockstep (`allowRootIORename` /
 *   `allowRootIOStructureEdit` off). Off (default) = full group-like parity.
 *
 * Rename/add/reorder the boundary handles via the Graph Input/Output pencil to
 * watch the signature change live. Gate logic AUTO-EMITS inline from the
 * `readInput`-based implementations — there are no authored `emit` hooks.
 */
export const CodegenStudio: StoryObj<typeof FullGraph> = {
  args: {},
  render: () => {
    // Built lazily (not at module load) so it runs after the circuit
    // definitions further down the file have initialized.
    const graphIoCircuit = useMemo(() => buildGraphIoCircuit(), []);
    return (
      <CodegenStudioView
        initialNodes={graphIoCircuit.nodes}
        initialEdges={graphIoCircuit.edges}
      />
    );
  },
};

/**
 * **Self-contained codegen** (`emitImplementations: 'source'`). A pre-wired
 * half-adder with the **`self-contained`** toggle ON: codegen BAKES the node
 * implementations into the module, so the emitted `runGraph()` runs standalone —
 * no `functionImplementations` argument. The Bit Output (`bitDisplay`) source-emits
 * as a baked `const bitDisplay = …` (one def, two calls); the gates auto-emit
 * inline. Toggle `self-contained` OFF and nodes return to threaded
 * `functionImplementations[…](…)` calls (the param reappears) — with `optimize`
 * OFF (this story's default) that threads EVERY node, gates included; turn
 * `optimize` ON to keep the gates auto-emitted inline (only `bitDisplay` threads)
 * and to dead-code-eliminate the (output-less) display calls entirely.
 * A node codegen can't prove behaves identically to the executor (e.g. one reading
 * `context.state`, or passing a handle to a helper) gracefully keeps its threaded
 * call and emits a `// warning:` — the artifact is always runnable.
 */
export const CodegenSelfContained: StoryObj<typeof FullGraph> = {
  args: {},
  render: () => {
    const circuit = useMemo(() => buildSelfContainedDemoCircuit(), []);
    return (
      <CodegenStudioView
        initialNodes={circuit.nodes}
        initialEdges={circuit.edges}
        initialSelfContained
        initialOptimize={false}
      />
    );
  },
};

/**
 * Showcases the opt-in dead-code elimination pass. Build a circuit, then pick a
 * single output to "Return only:" — the exported `runGraph` is recompiled with
 * `returnValues` + `assumePureImplementations`, dropping every pure node that the
 * chosen result does not depend on (transitively). Selecting "(everything)"
 * returns the full value map and keeps every node.
 */
export const CodegenOptimizer: StoryObj<typeof FullGraph> = {
  args: {},
  render: () => {
    const { state, dispatch } = useFullGraph<
      CircuitDataTypeId,
      CircuitNodeTypeId
    >({
      dataTypes: circuitExampleDataTypes,
      typeOfNodes: circuitExampleTypeOfNodes,
      nodes: [],
      edges: [],
      allowedConversionsBetweenDataTypes: {
        bit: { condition: true },
        condition: { bit: true },
      },
      allowConversionBetweenComplexTypesUnlessDisallowedByComplexTypeChecking: true,
      enableComplexTypeChecking: true,
      enableTypeInference: true,
      enableCycleChecking: true,
      enableRecursionChecking: true,
      nodeCountConstraints: standardNodeCountConstraints,
    });

    const [returnKey, setReturnKey] = useState('');
    const [code, setCode] = useState('');
    const [stats, setStats] = useState('');

    // Every node output handle, as a pickable `nodeId:handleId` return value.
    const outputOptions = useMemo(() => {
      const options: { key: string; label: string }[] = [];
      for (const graphNode of state.nodes) {
        const outputs =
          (
            graphNode.data as unknown as {
              outputs?: Array<{ id: string; name: string }>;
            }
          ).outputs ?? [];
        for (const output of outputs) {
          options.push({
            key: `${graphNode.id}:${output.id}`,
            label: `${graphNode.id.slice(0, 8)} · ${output.name}`,
          });
        }
      }
      return options;
    }, [state.nodes]);

    // Reset the picker if the chosen node is deleted.
    useEffect(() => {
      if (
        returnKey &&
        !outputOptions.some((option) => option.key === returnKey)
      ) {
        setReturnKey('');
      }
    }, [outputOptions, returnKey]);

    useEffect(() => {
      try {
        const plan = compile<CircuitDataTypeId, CircuitNodeTypeId>(
          state,
          circuitImplementations,
          { maxLoopIterations: 100 },
        );
        const optimize = returnKey !== '';
        const full = emitJs<CircuitDataTypeId, CircuitNodeTypeId>(plan, state, {
          metadata: circuitCodegenMetadata,
        });
        const optimized = optimize
          ? emitJs<CircuitDataTypeId, CircuitNodeTypeId>(plan, state, {
              metadata: circuitCodegenMetadata,
              returnValues: [returnKey],
              assumePureImplementations: true,
            })
          : full;
        setCode(optimized);
        const countNodes = (source: string) =>
          (source.match(/^\s*\/\/ node /gm) ?? []).length;
        setStats(
          optimize
            ? `Dead-code elimination: ${countNodes(full)} → ${countNodes(optimized)} node calls (returning only ${returnKey})`
            : `No optimization — returning all values (${countNodes(full)} node calls)`,
        );
      } catch (error) {
        setCode(
          `// Could not generate code from the current graph:\n// ${String(error)}`,
        );
        setStats('');
      }
    }, [state, returnKey]);

    return (
      <div style={{ height: '100vh', display: 'flex' }}>
        <div style={{ flex: 1, minWidth: 0, borderRight: '1px solid #3f3f46' }}>
          <FullGraph<CircuitDataTypeId, CircuitNodeTypeId>
            state={state}
            dispatch={dispatch}
            functionImplementations={circuitImplementations}
            runTargets={[
              circuitCodegenJsRunTarget,
              circuitCodegenTsRunTarget,
              jsonIrRunTarget,
            ]}
          />
        </div>
        <div
          style={{
            width: '46%',
            display: 'flex',
            flexDirection: 'column',
            background: '#1e1e1e',
            fontFamily: 'sans-serif',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              background: '#27272a',
              color: '#e4e4e7',
              fontSize: 13,
            }}
          >
            <strong style={{ marginRight: 'auto' }}>Optimized export →</strong>
            <label style={{ fontSize: 12, color: '#a1a1aa' }}>
              Return only:
            </label>
            <select
              value={returnKey}
              onChange={(event) => setReturnKey(event.target.value)}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid #71717a',
                background: '#18181b',
                color: '#e4e4e7',
                cursor: 'pointer',
                maxWidth: 240,
              }}
            >
              <option value=''>(everything — no DCE)</option>
              {outputOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div
            style={{
              padding: '6px 12px',
              background: '#0f0f12',
              color: '#a7f3d0',
              fontSize: 12,
              fontFamily: 'monospace',
            }}
          >
            {stats}
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Editor
              height='100%'
              language='javascript'
              theme='vs-dark'
              value={code}
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                readOnly: true,
              }}
            />
          </div>
        </div>
      </div>
    );
  },
};
