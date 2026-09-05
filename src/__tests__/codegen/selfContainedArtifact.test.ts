import { describe, it, expect } from 'vitest';
import { eliminateDeadCode } from '@/codegen/ast/deadCode';
import { loadTs } from '@/codegen/tsLoader';

// Unit half of the self-contained-artifact suite: the `signatureOnly` /
// `implCallNames` behaviour of the dead-code pass, exercised with inline source
// strings (no executor). The end-to-end source-emission PARITY cases (which
// eval the emitted module vs the in-process executor) stay in the host library,
// where `execute`/`compile` live.

describe('eliminateDeadCode — signatureOnly + implCallNames', () => {
  it('drops an unreferenced functionImplementations param, keeps options/async/header', async () => {
    const ts = await loadTs();
    const source = [
      '// header line one',
      '// header line two',
      '',
      'async function runGraph(functionImplementations, options = {}) {',
      '  const abortSignal = options.abortSignal;',
      '  const x = await localFn(abortSignal);',
      '  return { "n:o": x };',
      '}',
      '',
      'export { runGraph };',
    ].join('\n');

    const cleaned = eliminateDeadCode(ts, source, { signatureOnly: true });

    expect(cleaned).toMatch(/function runGraph\(options = \{\}\)/);
    expect(cleaned).not.toContain('functionImplementations');
    expect(cleaned).toContain('async'); // an await survives
    // Header preserved by the printer EXACTLY once (no drop, no duplicate).
    expect(cleaned.split('header line one').length - 1).toBe(1);
    expect(cleaned).toContain('export { runGraph };');
  });

  it('keeps a side-effecting baked node under full DCE unless assumePure (implCallNames floor)', async () => {
    const ts = await loadTs();
    const source = [
      'async function runGraph(options = {}) {',
      '  const display = (i) => undefined;',
      '  const out = await display(1);', // a baked impl call binding, output unused
      '  return {};',
      '}',
    ].join('\n');

    // Without assumePure: the binding is treated as side-effecting (kept).
    const kept = eliminateDeadCode(ts, source, {
      implCallNames: new Set(['display']),
    });
    expect(kept).toContain('await display(1)');

    // With assumePure: the dead binding is prunable.
    const pruned = eliminateDeadCode(ts, source, {
      implCallNames: new Set(['display']),
      assumePureImplementations: true,
    });
    expect(pruned).not.toContain('await display(1)');
  });
});
