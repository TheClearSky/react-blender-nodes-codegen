// The codegen package boundary. Everything codegen needs from the host
// library crosses HERE and nowhere else: the runner IR / graph-state types
// and the executor's own classifiers/value helpers, re-exported from the
// React-free `@theclearsky/react-blender-nodes/contract` subpath. An ESLint
// rule forbids `src/codegen/**` from importing the peer directly except
// through this file. See docs/codegenDoc.md.

// ── Runner plan IR + core state shape (type-only) ────────────────────────────
export type {
  ExecutionPlan,
  ExecutionStep,
  StandardExecutionStep,
  LoopExecutionBlock,
  SwitchExecutionBlock,
  GroupExecutionScope,
  State,
  SupportedUnderlyingTypes,
  MinimalNodeData,
} from '@theclearsky/react-blender-nodes/contract';

// ── Executor classifiers + value-store helpers ───────────────────────────────
// Reused so codegen ≡ executor by construction (the generated control-flow and
// handle classification match the runtime exactly). Re-exported as values.
export {
  getDataHandleIds,
  findConditionInputId,
  qualifiedId,
  flattenInputs,
} from '@theclearsky/react-blender-nodes/contract';

// ── Codegen metadata (Decision 6) ────────────────────────────────────────────
// Per-node and per-data-type codegen behavior. Supplied to the codegen factory
// (`makeCodegenRunTarget`) / `emitJs` — NOT stored on the core `TypeOfNode` /
// `DataType` (which carry no codegen fields). This keeps the editor core free of
// codegen concerns and is the clean seam the future package owns.

/** Context passed to a node type's `emit` hook. `inputs` maps each input handle
 *  NAME to its FIRST-connection source expression in the generated module;
 *  `inputsAll` maps each input handle NAME to an array-literal expression of ALL
 *  its fan-in connection expressions (e.g. `[B, B_2]`) — the codegen analogue of
 *  `readInput(inputs, name)` returning the whole array. A scalar hook uses
 *  `inputs.X`; a fan-in-aware hook uses `inputsAll.X`. The hook returns an
 *  expression per OUTPUT handle name. */
export type CodegenEmitContext = {
  inputs: Readonly<Record<string, string>>;
  inputsAll: Readonly<Record<string, string>>;
  outputs: ReadonlyArray<string>;
  nodeId: string;
  language: 'javascript' | 'typescript';
};

/** Per-node-type codegen behavior. */
export type NodeCodegenMetadata = {
  /** Render this node type inline as a source expression per output handle name
   *  (e.g. `a && b`) instead of a value-API call. Cover every output to opt in;
   *  a partial/throwing return falls back to the call form. */
  emit?: (context: CodegenEmitContext) => Readonly<Record<string, string>>;
  /** When true, `emit` is proven safe under input fan-in (it sources each input
   *  from `inputs` (first) or `inputsAll` (array) exactly as the implementation
   *  reads it), so lowering inlines it even when an input has multiple incoming
   *  edges. Set by auto-emit derivation; an authored opaque `emit` hook leaves it
   *  unset and stays guarded (a fan-in input forces the threaded call form). */
  emitFanInSafe?: boolean;
};

/** All codegen metadata, keyed by id. Passed to the codegen factory / `emitJs`. */
export type CodegenMetadata = {
  /** node-type id → codegen behavior. */
  nodeTypeMetadata?: Record<string, NodeCodegenMetadata>;
  /** data-type id → TypeScript type expression for the TS target's casts
   *  (e.g. `{ bit: 'boolean' }`); absent ⇒ `unknown`. */
  dataTypeToTsType?: Record<string, string>;
};
