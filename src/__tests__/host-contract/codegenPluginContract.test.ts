import { describe, it, expect } from 'vitest';
import { emitGraph, emitJs } from '@/index';

// Silent-`any` tripwire for the codegen-extraction boundary.
//
// Main resolves the extracted `@theclearsky/react-blender-nodes-codegen` plugin
// via a tsconfig path to its BUILT declaration bundle. If that resolution ever
// silently degrades the plugin's exports to `any` — a stale/unbuilt dist, a wrong
// path, or `skipLibCheck` masking a broken `.d.ts` — the real integration types
// would be gone yet every behavioral test would still pass. The COMPILE-TIME
// assertions below turn that into a hard `tsc -b` failure; the RUNTIME check
// proves the module actually resolves to callable functions (not `undefined`).

type IsAny<T> = 0 extends 1 & T ? true : false;
// Resolves to `true` only when T is genuinely typed; collapses to `never` (an
// unassignable target) the moment T widens to `any`.
type AssertNotAny<T> = IsAny<T> extends true ? never : true;

const _emitGraphIsTyped: AssertNotAny<typeof emitGraph> = true;
const _emitJsIsTyped: AssertNotAny<typeof emitJs> = true;
void _emitGraphIsTyped;
void _emitJsIsTyped;

describe('codegen plugin integration boundary', () => {
  it('resolves the plugin entry points as real, non-any typed functions', () => {
    expect(typeof emitGraph).toBe('function');
    expect(typeof emitJs).toBe('function');
  });
});
