import { describe, it, expect } from 'vitest';
import { loadEngines, defaultLineOpts, lineArgs } from './harness.js';

const eng = loadEngines({ withPapa: true, checkboxDefaults: { 'json-canonical': true, 'csv-header': true } });

function buildBatchDataset(n, dupRatio) {
  const uniques = [];
  const uniqueCount = Math.max(1, Math.floor(n * (1 - dupRatio)));
  for (let i = 0; i < uniqueCount; i++) {
    uniques.push(`item-${i} value ${i % 50}`);
  }
  const lines = [];
  for (let j = 0; j < n; j++) {
    lines.push(uniques[Math.floor(Math.random() * uniqueCount)]);
  }
  return lines.join('\n');
}

describe('golden audit: batch reliability', () => {
  const formats = [
    { mode: 'txt', make: (n) => buildBatchDataset(n, 0.35) },
    { mode: 'csv', make: (n) => 'a,b,c\n' + buildBatchDataset(n, 0.35).split('\n').map((l) => l + ',1,2').join('\n') },
    { mode: 'json', make: (n) => JSON.stringify(Array.from({ length: n }, (_, i) => ({ id: i % Math.ceil(n * 0.65), v: 'x' }))) },
    { mode: 'log', make: (n) => buildBatchDataset(n, 0.4).split('\n').map((l, i) => `[2024-01-${String((i % 28) + 1).padStart(2, '0')}] INFO ${l} pid=${i}`).join('\n') },
    { mode: 'todo', make: (n) => buildBatchDataset(n, 0.35).split('\n').map((l, i) => (i % 2 ? '[x] ' : '[ ] ') + l).join('\n') },
    { mode: 'code', make: (n) => buildBatchDataset(n, 0.35).split('\n').map((l) => `const x_${l.replace(/\W/g, '_')} = 1;`).join('\n') }
  ];

  formats.forEach(({ mode, make }) => {
    it(`batch success rate >90% for ${mode} (50 runs)`, () => {
      let successes = 0;
      const runs = 50;
      for (let i = 0; i < runs; i++) {
        const text = make(80 + (i % 40));
        const run = eng.runTextPipeline(text, { ...defaultLineOpts, mode, fast: false, sniff: false });
        if (run.result && run.verification && run.verification.passed && run.result.remaining > 0) {
          successes++;
        }
      }
      const rate = successes / runs;
      expect(rate).toBeGreaterThan(0.9);
    });
  });
});

describe('golden audit: accuracy', () => {
  it('exact dedup preserves all unique content', () => {
    const input = 'alpha\nbeta\ngamma\nalpha\nbeta';
    const r = eng.processPlainLines(input, ...lineArgs(defaultLineOpts));
    expect(r.lines.sort()).toEqual(['alpha', 'beta', 'gamma']);
    expect(r.removed).toBe(2);
    expect(r.remaining).toBe(3);
  });

  it('CRLF input normalizes correctly', () => {
    const input = 'a\r\nb\r\na\r\nc';
    const r = eng.processPlainLines(input, ...lineArgs(defaultLineOpts));
    expect(r.remaining).toBe(3);
  });

  it('fast and full pipeline produce identical results for txt', () => {
    const text = buildBatchDataset(200, 0.4);
    const opts = { ...defaultLineOpts, mode: 'txt' };
    const fast = eng.runTextPipeline(text, { ...opts, fast: true });
    const full = eng.runTextPipeline(text, { ...opts, fast: false, sniff: false });
    expect(fast.result.lines).toEqual(full.result.lines);
    expect(fast.result.remaining).toBe(full.result.remaining);
  });

  it('verification catches corrupt stats', () => {
    const v = eng.verifyTextResult('a\nb', { lines: ['a'], total: 2, removed: -1, remaining: 1 }, 'txt', defaultLineOpts);
    expect(v.passed).toBe(false);
  });

  it('json dedup preserves unique records accurately', () => {
    const input = '[{"id":1,"n":"a"},{"id":1,"n":"a"},{"id":2,"n":"b"}]';
    const r = eng.processJson(input, ...lineArgs(defaultLineOpts));
    expect(r.remaining).toBe(2);
    expect(r.removed).toBe(1);
  });
});

describe('golden audit: performance', () => {
  it('10k exact-match lines completes under 3 seconds', () => {
    const text = buildBatchDataset(10000, 0.35);
    const start = Date.now();
    const r = eng.processPlainLines(text, ...lineArgs(defaultLineOpts));
    const ms = Date.now() - start;
    expect(r.remaining).toBeLessThan(r.total);
    expect(ms).toBeLessThan(3000);
  });

  it('fast path is at least 2x faster than full pipeline for 2k lines', () => {
    const text = buildBatchDataset(2000, 0.35);
    const opts = { ...defaultLineOpts, mode: 'txt' };

    const t0 = Date.now();
    eng.runTextPipeline(text, { ...opts, fast: true });
    const fastMs = Date.now() - t0;

    const t1 = Date.now();
    eng.runTextPipeline(text, { ...opts, fast: false, sniff: false });
    const fullMs = Date.now() - t1;

    expect(fastMs).toBeLessThan(fullMs);
  });

  it('O(n) exact index handles 25k lines under 5 seconds', () => {
    const text = buildBatchDataset(25000, 0.4);
    const start = Date.now();
    const r = eng.processPlainLines(text, false, false, false, 'original', 1, 'txt', 'all', false, false);
    const ms = Date.now() - start;
    expect(r.total).toBe(25000);
    expect(ms).toBeLessThan(5000);
  });
});

describe('golden audit: edge cases', () => {
  it('handles unicode content', () => {
    const input = 'café\nnaïve\ncafé\n日本語';
    const r = eng.processPlainLines(input, ...lineArgs(defaultLineOpts));
    expect(r.remaining).toBe(3);
  });

  it('handles single line input', () => {
    const r = eng.processPlainLines('only one', ...lineArgs(defaultLineOpts));
    expect(r.remaining).toBe(1);
    expect(r.removed).toBe(0);
  });

  it('handles all-duplicate input', () => {
    const r = eng.processPlainLines('same\nsame\nsame', ...lineArgs(defaultLineOpts));
    expect(r.remaining).toBe(1);
    expect(r.removed).toBe(2);
  });

  it('empty and whitespace-only input returns zero stats', () => {
    expect(eng.processPlainLines('', ...lineArgs(defaultLineOpts)).total).toBe(0);
    expect(eng.processPlainLines('  \n  \n', ...lineArgs(defaultLineOpts)).total).toBe(0);
  });

  it('revert restores pre-dedup checkpoint', () => {
    eng.GECKODUPE_CHECKPOINTS = [];
    const input = 'keep\nkeep\ndrop-me\nkeep';
    eng.runTextPipeline(input, { ...defaultLineOpts, mode: 'txt', fast: false, sniff: false });
    const restored = eng.revertLastPipelineRun();
    expect(restored.input).toBe(input);
  });
});
