/**
 * @fileoverview `@theclearsky/react-blender-nodes-codegen` — the codegen plugin
 * for `@theclearsky/react-blender-nodes`.
 *
 * Compiles a graph's `ExecutionPlan` (+ `State`) into a standalone, dependency-free
 * `runGraph` JavaScript/TypeScript module. Registered with the editor as an
 * `artifact` run target (`codegenJsRunTarget` / `codegenTsRunTarget`), or driven
 * headlessly via `emitGraph` / `emitJs`.
 *
 * It reaches the host library ONLY through the React-free
 * `@theclearsky/react-blender-nodes/contract` subpath (peer dependency), so it
 * carries no React at runtime.
 *
 * @example
 * ```tsx
 * import { codegenJsRunTarget, codegenTsRunTarget } from '@theclearsky/react-blender-nodes-codegen';
 * <FullGraph … runTargets={[codegenJsRunTarget, codegenTsRunTarget]} />
 * ```
 */

// ── Run targets (the editor-facing entry) ────────────────────────────────────
export {
  makeCodegenRunTarget,
  codegenJsRunTarget,
  codegenTsRunTarget,
} from './codegenRunTarget';
export type { CodegenRunTargetOptions } from './codegenRunTarget';

// ── Programmatic emit ────────────────────────────────────────────────────────
export { emitGraph } from './codegen/emitGraph';
export type { EmitGraphOptions, OptimizePasses } from './codegen/emitGraph';
export { emitJs } from './codegen/emitJs';
export type { EmitJsOptions } from './codegen/emitJs';
export type { PrintLanguage } from './codegen/printJs';

// ── Codegen metadata (per-node-type `emit` hooks + dataType→TS type map) ──────
export type {
  CodegenMetadata,
  NodeCodegenMetadata,
  CodegenEmitContext,
} from './codegen/contract';
