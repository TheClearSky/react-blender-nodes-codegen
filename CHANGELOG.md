# Changelog

## 0.0.1 — 2026-09-06

### Added — initial extraction

- Extracted the codegen subsystem out of `@theclearsky/react-blender-nodes` into
  this standalone package. The base library now carries no `typescript` /
  `prettier` weight; consumers who want codegen install this plugin and pass
  `codegenJsRunTarget` / `codegenTsRunTarget` to `<FullGraph runTargets={…} />`.
- Public API: `emitGraph` (async v2 entry), `emitJs` (raw string emit),
  `makeCodegenRunTarget` + the two built-in targets, and the option / metadata
  types (`EmitGraphOptions`, `OptimizePasses`, `EmitJsOptions`,
  `CodegenRunTargetOptions`, `PrintLanguage`, `CodegenMetadata`,
  `NodeCodegenMetadata`, `CodegenEmitContext`).
- Reaches the host library only through its React-free
  `@theclearsky/react-blender-nodes/contract` subpath (peer dependency
  `>=0.0.14 <1`), so the plugin runs headlessly under Node (see `npm run demo`).
- Added an IR-evolution guard: a host emitting a future `ExecutionStep` kind
  this codegen predates throws a named error rather than miscompiling.

### License

- Released under the GNU Affero General Public License v3.0 (`AGPL-3.0-only`);
  the `LICENSE` file is the verbatim gnu.org text. Emitted `runGraph` modules
  embed template code from this package, and those portions remain AGPL-covered.
  Commercial/proprietary licensing is available separately (contact
  `@TheClearSky`).
