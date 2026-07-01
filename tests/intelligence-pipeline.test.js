import { describe, it, expect, beforeEach } from 'vitest';
import { loadEngines, defaultLineOpts, lineArgs } from './harness.js';

describe('intelligence layer', () => {
  const eng = loadEngines();

  it('sniffs JSON from content', () => {
    const r = eng.sniffFormat('data.txt', '[{"a":1},{"a":1}]');
    expect(r.mode).toBe('json');
    expect(r.confidence).toBeGreaterThan(0.2);
  });

  it('sniffs log from timestamps', () => {
    const r = eng.sniffFormat('app.out', '[2024-01-01 10:00:00] INFO started\n[2024-01-02] INFO started');
    expect(r.mode).toBe('log');
  });

  it('sniffs code from extension and content', () => {
    const r = eng.sniffFormat('main.rs', 'fn main() {\n    println!("hi");\n}');
    expect(r.mode).toBe('code');
    expect(r.language.id).toBe('rust');
  });

  it('detects python language', () => {
    const lang = eng.detectLanguage('app.py', 'import os\ndef main():\n    pass');
    expect(lang.id).toBe('python');
  });

  it('detects kotlin via java profile family', () => {
    const lang = eng.detectLanguage('App.kt', 'fun main() {\n    println("hi")\n}');
    expect(['java', 'generic']).toContain(lang.id);
  });

  it('strips lua comments with profile', () => {
    const profile = eng.GECKO_LANGUAGE_PROFILES.lua;
    expect(eng.stripCodeCommentsWithProfile('local x = 1 -- inline', profile)).toBe('local x = 1');
  });

  it('marks binary extensions as skip', () => {
    const r = eng.sniffFormat('image.png', '');
    expect(r.mode).toBe('skip');
  });
});

describe('checkpoint system', () => {
  const eng = loadEngines();

  beforeEach(() => {
    eng.GECKODUPE_CHECKPOINTS = [];
    eng.GECKODUPE_LAST_CHECKPOINT_ID = null;
  });

  it('creates and restores checkpoints', () => {
    const id = eng.createCheckpoint('test', { input: 'hello', output: null });
    const restored = eng.restoreCheckpoint(id);
    expect(restored.input).toBe('hello');
  });

  it('lists checkpoints', () => {
    eng.createCheckpoint('a', { x: 1 });
    eng.createCheckpoint('b', { x: 2 });
    expect(eng.listCheckpoints().length).toBe(2);
  });

  it('deep clones binary data in folder files', () => {
    const buf = new Uint8Array([1, 2, 3]);
    const cloned = eng.cloneFolderFiles([{ path: 'a.bin', content: null, binary: true, binaryData: buf }]);
    expect(Array.from(cloned[0].binaryData)).toEqual([1, 2, 3]);
    expect(cloned[0].binaryData).not.toBe(buf);
  });
});

describe('verification layer', () => {
  const eng = loadEngines();
  const opts = defaultLineOpts;

  it('passes valid text dedup result', () => {
    const input = 'a\nb\na';
    const result = eng.processPlainLines(input, ...lineArgs(opts));
    const v = eng.verifyTextResult(input, result, 'txt', opts);
    expect(v.passed).toBe(true);
  });

  it('detects invalid stats', () => {
    const v = eng.verifyTextResult('a\nb', { lines: ['a'], total: 2, removed: -1, remaining: 1 }, 'txt', opts);
    expect(v.passed).toBe(false);
  });
});

describe('pipeline', () => {
  const eng = loadEngines({ withPapa: true });

  beforeEach(() => {
    eng.GECKODUPE_CHECKPOINTS = [];
    eng.GECKODUPE_LAST_CHECKPOINT_ID = null;
  });

  it('runs text pipeline with verification and checkpoint', () => {
    const run = eng.runTextPipeline('alpha\nbeta\nalpha', {
      ...defaultLineOpts,
      mode: 'txt'
    });
    expect(run.result.remaining).toBe(2);
    expect(run.verification.passed).toBe(true);
    expect(run.checkpointId).toBeTruthy();
    expect(run.canRevert).toBe(true);
  });

  it('retries with fallback on engine throw', () => {
    const orig = eng.processJson;
    let calls = 0;
    eng.processJson = function() {
      calls++;
      if (calls === 1) throw new Error('simulated parse failure');
      return orig.apply(this, arguments);
    };
    const run = eng.runTextPipeline('{"a":1}\n{"a":1}', {
      ...defaultLineOpts,
      mode: 'json'
    });
    eng.processJson = orig;
    expect(run.attempts.length).toBeGreaterThanOrEqual(1);
    expect(run.result).toBeTruthy();
  });

  it('reverts to pre-dedup checkpoint', () => {
    eng.runTextPipeline('x\nx', { ...defaultLineOpts, mode: 'txt' });
    const restored = eng.revertLastPipelineRun();
    expect(restored.type).toBe('text');
    expect(restored.input).toContain('x');
  });

  it('runs folder pipeline with verification', () => {
    const files = [{ path: 'a.txt', content: 'line\nline\nunique' }];
    const scope = {
      dedupFiles: false, dedupWithinFiles: true, dedupWithinCode: false,
      crossFileLines: false, detectCodeBlocks: false, removeCodeBlocks: false,
      preserveEntryPoints: true, ignoreNodeModules: true, ignoreGit: true,
      ignoreDist: true, ignoreVendor: true, canonicalStrategy: 'shortest', reportOnly: false
    };
    const run = eng.runFolderPipeline(files, scope, defaultLineOpts);
    expect(run.verification.passed).toBe(true);
    expect(run.result.stats.linesRemoved).toBe(1);
  });
});

describe('language-aware code engine', () => {
  it('deduplicates lua with comment awareness', () => {
    const eng = loadEngines({ checkboxDefaults: { 'code-comments': true, 'code-indent': true, 'code-trailing': true } });
    const input = 'local x = 1 -- first\nlocal x = 1 -- second';
    const r = eng.processCode(input, ...lineArgs(defaultLineOpts), 'main.lua');
    expect(r.remaining).toBe(1);
  });

  it('deduplicates rust functions', () => {
    const eng = loadEngines({ checkboxDefaults: { 'code-comments': true, 'code-indent': true, 'code-trailing': true } });
    const input = 'fn helper() {\n    return 1;\n}\nfn helper() {\n    return 1;\n}';
    const r = eng.processCode(input, ...lineArgs(defaultLineOpts), 'lib.rs');
    expect(r.remaining).toBeLessThan(4);
  });
});
