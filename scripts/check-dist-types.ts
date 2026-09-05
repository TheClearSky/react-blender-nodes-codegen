#!/usr/bin/env node
/**
 * check-dist-types.ts
 *
 * Build gate: type-check the rolled-up declaration bundle (dist/index.d.ts) the
 * way a CONSUMER compiles against it, so any import specifier that escapes the
 * published package surfaces as a hard error instead of silently degrading an
 * exported type to `any` under `skipLibCheck: true`. A clean API-Extractor rollup
 * is self-contained (only BARE external imports remain — here `zod` and the peer
 * `@theclearsky/react-blender-nodes/contract`; `typescript` is a runtime lazy
 * `import()` and does NOT appear in the d.ts); an escaping relative specifier
 * yields TS2307 "Cannot find module".
 *
 * NOTE: this checks resolvability of the peer via whatever tree it is installed in
 * (a `file:` dev-link resolves it from the host's node_modules). The STRONGER
 * clean-room check that the plugin's OWN dependency closure is complete lives in
 * the integration step (`npm pack` + isolated install) — see docs/codegenDoc.md.
 *
 * Run: node --experimental-strip-types scripts/check-dist-types.ts
 */
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const bundlePath = fileURLToPath(
  new URL('../dist/index.d.ts', import.meta.url),
);
const normalizedBundlePath = bundlePath.replace(/\\/g, '/');

const compilerOptions: ts.CompilerOptions = {
  noEmit: true,
  skipLibCheck: false,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  target: ts.ScriptTarget.ES2022,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  strict: false,
  types: [],
};

const program = ts.createProgram([bundlePath], compilerOptions);
const bundleDiagnostics = ts
  .getPreEmitDiagnostics(program)
  .filter(
    (diagnostic) =>
      diagnostic.file !== undefined &&
      diagnostic.file.fileName.replace(/\\/g, '/') === normalizedBundlePath,
  );

if (bundleDiagnostics.length > 0) {
  const formatHost: ts.FormatDiagnosticsHost = {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: () => ts.sys.newLine,
  };
  process.stderr.write(
    '[check-dist-types] dist/index.d.ts does not type-check as a standalone published bundle:\n\n',
  );
  process.stderr.write(
    ts.formatDiagnosticsWithColorAndContext(bundleDiagnostics, formatHost) +
      '\n',
  );
  process.stderr.write(
    '[check-dist-types] A TS2307 here means an inferred public type pulled a module path into the rollup that resolves OUTSIDE the package (or a peer/dep is unresolved). Fix: give the exported declaration an explicit type the file imports, or declare the dependency.\n',
  );
  process.exit(1);
}

// Encapsulation guard: the source-emission analysis wire types (`SourceEmissionPlan`,
// `EmittedFunction`) are INTERNAL — `emitJs` keeps them off the public `EmitJsOptions`
// via the `EmitJsOptionsInternal` split. They must never reach the published bundle;
// re-adding `sourceEmission?` to the PUBLIC type would re-pull them and STILL
// type-check clean (they resolve — they're just re-exposed), so type-checking alone
// can't catch the regression. Guard the surface text explicitly.
const bundleText = ts.sys.readFile(bundlePath) ?? '';
const leakedInternalTypes = ['SourceEmissionPlan', 'EmittedFunction'].filter(
  (name) => bundleText.includes(name),
);
if (leakedInternalTypes.length > 0) {
  process.stderr.write(
    `[check-dist-types] internal codegen analysis type(s) leaked into the published bundle: ${leakedInternalTypes.join(', ')}. These belong to src/codegen/analyze/sourceEmit.ts and must stay OFF the public EmitJsOptions (use EmitJsOptionsInternal).\n`,
  );
  process.exit(1);
}

// Dual-@types/react regression guard — pins the invariant the extraction fixed.
// The React-free `/contract` PEER must stay EXTERNAL in the rolled bundle: a BARE
// `import … from '@theclearsky/react-blender-nodes/contract'` that each consumer
// resolves against their OWN React tree. If a tsconfig `paths` entry to the peer
// FILE (or a bundling change) makes API Extractor INLINE the peer, the bundle still
// type-checks clean above, but the inlined React `CSSProperties` re-bind to THIS
// repo's `@types/react` and stop being assignable to the host's / consumer's
// `State`. Type-checking can't catch that (it resolves), so pin the surface text.
// Part A — the peer MUST still be imported as a bare external. A re-inline (a
// tsconfig `paths` entry to the peer file, or a bundling change) removes this
// import entirely.
const hasExternalPeerImport =
  /from ['"]@theclearsky\/react-blender-nodes\/contract['"]/.test(bundleText);
if (!hasExternalPeerImport) {
  process.stderr.write(
    "[check-dist-types] dist/index.d.ts no longer imports the '/contract' peer as a bare external — it was likely INLINED (a tsconfig `paths` entry to the peer file, or a bundling change). Resolve the peer via node_modules (no `paths` entry) so the published d.ts stays consumer-agnostic. See tsconfig.app.json.\n",
  );
  process.exit(1);
}
// Part B — the bundle must import NOTHING but the peer `/contract` + `zod`. If the
// peer is inlined, its `State`/`ArtifactRunContext` types drag the host's editor
// type deps (`@xyflow/react`, `immer`, `react`/`csstype`) in as fresh imports —
// re-binding React to THIS repo's `@types/react` (the dual-`@types/react`
// regression). Enumerate every import specifier and fail on anything unexpected.
const allowedImports = new Set([
  '@theclearsky/react-blender-nodes/contract',
  'zod',
]);
const importSpecifierRe = /(?:from|import)\s*\(?\s*['"]([^'"\n]+)['"]/g;
const unexpectedImports = [
  ...new Set(
    Array.from(bundleText.matchAll(importSpecifierRe), (match) => match[1]),
  ),
].filter((specifier) => !allowedImports.has(specifier));
if (unexpectedImports.length > 0) {
  process.stderr.write(
    '[check-dist-types] dist/index.d.ts imports unexpected module(s): ' +
      unexpectedImports.join(', ') +
      ". The published bundle must import ONLY the peer '@theclearsky/react-blender-nodes/contract' + 'zod'; anything else means the peer was INLINED and leaked the host's React/@xyflow/immer type deps (the dual-@types/react regression). Keep the peer EXTERNAL — see tsconfig.app.json.\n",
  );
  process.exit(1);
}

process.stdout.write(
  '[check-dist-types] OK — dist/index.d.ts type-checks as a standalone bundle (no escaping imports, peer stays external).\n',
);
