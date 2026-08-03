import { describe, it, expect } from 'vitest';
import { loadEngines, defaultLineOpts, lineArgs } from './harness.js';

const opts = defaultLineOpts;

describe('core engine', () => {
  const { processPlainLines, calculateSimilarity, getWordSet } = loadEngines();

  it('deduplicates exact lines', () => {
    const r = processPlainLines('alpha\nbeta\nbeta\nalpha', false, false, false, 'original', 1, 'txt', 'all', false, false);
    expect(r.lines).toEqual(['alpha', 'beta']);
    expect(r.removed).toBe(2);
    expect(r.remaining).toBe(2);
  });

  it('stacks duplicates when doStack is true', () => {
    const r = processPlainLines('alpha\nbeta\nbeta', true, false, false, 'original', 1, 'txt', 'all', false, false);
    expect(r.lines).toEqual(['x1 alpha', 'x2 beta']);
  });

  it('ignores capitals when doCaps is true', () => {
    const r = processPlainLines('Alpha\nalpha\nALPHA', false, true, false, 'original', 1, 'txt', 'all', false, false);
    expect(r.remaining).toBe(1);
    expect(r.removed).toBe(2);
  });

  it('fuzzy matches similar lines above threshold', () => {
    const r = processPlainLines(
      'the quick brown fox\na quick brown fox jumps',
      false, false, false, 'original', 0.5, 'txt', 'all', false, false
    );
    expect(r.remaining).toBe(1);
  });

  it('does not fuzzy match below threshold', () => {
    const r = processPlainLines(
      'completely different sentence\nanother unrelated phrase entirely',
      false, false, false, 'original', 0.9, 'txt', 'all', false, false
    );
    expect(r.remaining).toBe(2);
  });

  it('strips markdown bullets when option enabled', () => {
    const eng = loadEngines({ checkboxDefaults: { 'md-bullets': true } });
    const r = eng.processPlainLines('- apple\n* apple\n1. apple', false, false, false, 'original', 1, 'txt', 'all', false, false);
    expect(r.remaining).toBe(1);
  });

  it('ignores punctuation when option enabled', () => {
    const r = processPlainLines('hello world!\nhello world', false, false, false, 'original', 1, 'txt', 'all', true, false);
    expect(r.remaining).toBe(1);
  });

  it('collapses whitespace when option enabled', () => {
    const r = processPlainLines('hello   world\nhello world', false, false, false, 'original', 1, 'txt', 'all', false, true);
    expect(r.remaining).toBe(1);
  });

  it('filters to duplicates only', () => {
    const r = processPlainLines('a\nb\na\nc', false, false, false, 'original', 1, 'txt', 'duplicates', false, false);
    expect(r.lines).toEqual(['a']);
    expect(r.remaining).toBe(1);
  });

  it('filters to singletons only', () => {
    const r = processPlainLines('a\nb\na\nc', false, false, false, 'original', 1, 'txt', 'singletons', false, false);
    expect(r.lines.sort()).toEqual(['b', 'c']);
  });

  it('sorts alphabetically ascending', () => {
    const r = processPlainLines('zebra\nalpha\nbeta', false, false, false, 'alpha-asc', 1, 'txt', 'all', false, false);
    expect(r.lines).toEqual(['alpha', 'beta', 'zebra']);
  });

  it('sorts by frequency descending', () => {
    const r = processPlainLines('a\nb\na\na\nb', false, false, false, 'freq-desc', 1, 'txt', 'all', false, false);
    expect(r.lines[0]).toBe('a');
    expect(r.lines[1]).toBe('b');
  });

  it('returns empty for blank input', () => {
    const r = processPlainLines('  \n  ', false, false, false, 'original', 1, 'txt', 'all', false, false);
    expect(r.total).toBe(0);
    expect(r.lines).toEqual([]);
  });

  it('calculateSimilarity handles identical strings', () => {
    expect(calculateSimilarity('hello world', 'hello world')).toBe(1);
  });

  it('calculateSimilarity handles empty word sets', () => {
    expect(calculateSimilarity('!!!', '???')).toBe(0);
    expect(calculateSimilarity('!!!', '!!!')).toBe(1);
  });

  it('caches word sets for performance', () => {
    const set1 = getWordSet('hello world');
    const set2 = getWordSet('world hello');
    expect(calculateSimilarity('hello world', 'world hello')).toBe(1);
    expect(set1.size).toBe(2);
    expect(set2.size).toBe(2);
  });
});

describe('csv engine', () => {
  const eng = loadEngines({ checkboxDefaults: { 'csv-header': true }, withPapa: true });
  const { processCsv } = eng;

  it('preserves header row', () => {
    const csv = 'name,age\nalice,30\nbob,25\nalice,30';
    const r = processCsv(csv, ...lineArgs(opts));
    expect(r.lines[0]).toBe('name,age');
    expect(r.remaining).toBe(3);
    expect(r.removed).toBe(1);
  });

  it('deduplicates data rows', () => {
    const csv = 'a,b\n1,2\n1,2\n3,4';
    const r = processCsv(csv, ...lineArgs(opts));
    expect(r.lines).toEqual(['a,b', '1,2', '3,4']);
  });

  it('stacks duplicate rows', () => {
    const csv = 'x,y\n1,2\n1,2';
    const r = processCsv(csv, true, false, false, 'original', 1, 'all', false, false);
    expect(r.lines[1]).toBe('x2 1,2');
  });
});

describe('json engine', () => {
  const eng = loadEngines({ checkboxDefaults: { 'json-canonical': true, 'json-pretty': true } });
  const { processJson, canonicalizeJson } = eng;

  it('deduplicates JSON array with canonical key matching', () => {
    const input = '[{"b":2,"a":1},{"a":1,"b":2},{"c":3}]';
    const r = processJson(input, ...lineArgs(opts));
    expect(r.remaining).toBe(2);
    expect(r.removed).toBe(1);
  });

  it('deduplicates JSONL lines', () => {
    const input = '{"id":1}\n{"id":1}\n{"id":2}';
    const r = processJson(input, ...lineArgs(opts));
    expect(r.remaining).toBe(2);
    expect(r.removed).toBe(1);
  });

  it('canonicalizeJson sorts keys', () => {
    expect(canonicalizeJson({ b: 1, a: 2 })).toBe(canonicalizeJson({ a: 2, b: 1 }));
  });

  it('outputs pretty-printed array when not stacking', () => {
    const input = '[{"a":1},{"a":2}]';
    const r = processJson(input, ...lineArgs(opts));
    expect(r.lines.join('\n')).toContain('"a"');
    expect(r.lines.length).toBeGreaterThan(1);
  });
});

describe('log engine', () => {
  const eng = loadEngines({
    checkboxDefaults: {
      'log-strip-dates': true,
      'log-strip-pids': true,
      'log-strip-uuids': true,
      'log-strip-levels': true
    }
  });
  const { processLog } = eng;

  it('groups log lines with different timestamps', () => {
    const input = [
      '[2024-01-01 10:00:00] INFO User login pid=123',
      '[2024-01-02 11:00:00] INFO User login pid=456',
      '[2024-01-03 12:00:00] ERROR Disk full'
    ].join('\n');
    const r = processLog(input, ...lineArgs(opts));
    expect(r.remaining).toBe(2);
    expect(r.removed).toBe(1);
  });

  it('strips UUIDs for comparison', () => {
    const input = [
      'req id 550e8400-e29b-41d4-a716-446655440000 failed',
      'req id 550e8400-e29b-41d4-a716-446655440001 failed'
    ].join('\n');
    const r = processLog(input, ...lineArgs(opts));
    expect(r.remaining).toBe(1);
  });
});

describe('code engine', () => {
  const eng = loadEngines({
    checkboxDefaults: {
      'code-comments': true,
      'code-indent': true,
      'code-trailing': true,
      'code-docstrings': true
    }
  });
  const { processCode } = eng;

  it('deduplicates lines ignoring comments', () => {
    const input = 'const x = 1; // init\nconst x = 1;\nconst y = 2;';
    const r = processCode(input, ...lineArgs(opts));
    expect(r.remaining).toBe(2);
    expect(r.removed).toBe(1);
  });

  it('deduplicates lines ignoring indentation', () => {
    const input = '  return true;\nreturn true;';
    const r = processCode(input, ...lineArgs(opts));
    expect(r.remaining).toBe(1);
  });

  it('groups imports when sort-imports enabled', () => {
    const engSort = loadEngines({
      checkboxDefaults: {
        'code-comments': true,
        'code-indent': true,
        'code-trailing': true,
        'code-sort-imports': true
      }
    });
    const input = 'import z\nimport a\nprint(1)';
    const r = engSort.processCode(input, ...lineArgs(opts));
    expect(r.lines[0]).toMatch(/import a/);
    expect(r.lines[1]).toMatch(/import z/);
  });
});

describe('todo engine', () => {
  const eng = loadEngines({
    checkboxDefaults: { 'todo-state': true, 'todo-prefixes': true }
  });
  const { processTodo } = eng;

  it('treats checked and unchecked as same task', () => {
    const input = '[ ] Buy milk\n[x] Buy milk\nTODO: Buy milk';
    const r = processTodo(input, ...lineArgs(opts));
    expect(r.remaining).toBe(1);
    expect(r.removed).toBe(2);
  });

  it('prefers completed line when duplicate found', () => {
    const input = '[ ] Task one\n[x] Task one';
    const r = processTodo(input, ...lineArgs(opts));
    expect(r.lines[0]).toMatch(/\[x\]/i);
  });
});

describe('folder engine', () => {
  const eng = loadEngines({ withXlsx: true });
  const { processFolderProject, detectFormatFromPath, shouldIgnorePath, normalizePath, parseManualSkips, compileManualSkips, matchesManualSkip } = eng;

  const lineOpts = { ...opts };

  it('normalizes paths', () => {
    expect(normalizePath('foo\\bar\\baz')).toBe('foo/bar/baz');
    expect(normalizePath('//foo//bar//')).toBe('foo/bar/');
  });

  it('detects formats from path', () => {
    expect(detectFormatFromPath('data.csv')).toBe('csv');
    expect(detectFormatFromPath('app.py')).toBe('code');
    expect(detectFormatFromPath('notes.md')).toBe('txt');
    expect(detectFormatFromPath('data.xlsx')).toBe('excel');
  });

  it('ignores node_modules and .git', () => {
    expect(shouldIgnorePath('node_modules/pkg/index.js', { ignoreNodeModules: true, ignoreGit: true, ignoreDist: true, ignoreVendor: true })).toBe(true);
    expect(shouldIgnorePath('.git/config', { ignoreNodeModules: true, ignoreGit: true, ignoreDist: true, ignoreVendor: true })).toBe(true);
    expect(shouldIgnorePath('src/app.js', { ignoreNodeModules: true, ignoreGit: true, ignoreDist: true, ignoreVendor: true })).toBe(false);
  });

  it('parses manual skip rules', () => {
    expect(parseManualSkips('secrets\n# comment\n\n*.lock')).toEqual(['secrets', '*.lock']);
  });

  it('matches manual skip rules by segment, path, and glob', () => {
    const compiled = compileManualSkips(parseManualSkips('secrets\nconfig/local.env\n*.lock'));
    expect(matchesManualSkip('project/secrets/db.env', compiled)).toBe(true);
    expect(matchesManualSkip('config/local.env', compiled)).toBe(true);
    expect(matchesManualSkip('pkg/yarn.lock', compiled)).toBe(true);
    expect(matchesManualSkip('src/app.js', compiled)).toBe(false);
  });

  it('manual skip leaves matched files unchanged', () => {
    const files = [
      { path: 'data/items.txt', content: 'apple\napple\ncherry' },
      { path: 'secrets/config.env', content: 'key=1\nkey=1\nkey=1' }
    ];
    const scope = {
      dedupFiles: false,
      dedupWithinFiles: true,
      dedupWithinCode: false,
      crossFileLines: false,
      detectCodeBlocks: false,
      removeCodeBlocks: false,
      preserveEntryPoints: true,
      ignoreNodeModules: true,
      ignoreGit: true,
      ignoreDist: true,
      ignoreVendor: true,
      canonicalStrategy: 'shortest',
      reportOnly: false,
      manualSkipsCompiled: compileManualSkips(parseManualSkips('secrets'))
    };
    const result = processFolderProject(files, scope, lineOpts);
    const skipped = result.files.find((f) => f.path === 'secrets/config.env');
    const processed = result.files.find((f) => f.path === 'data/items.txt');
    expect(skipped.content).toBe('key=1\nkey=1\nkey=1');
    expect(skipped.skip).toBe(true);
    expect(result.stats.passthroughFiles).toBe(1);
    expect(processed.content).toBe('apple\ncherry');
  });

  it('built-in folder excludes can be turned off', () => {
    expect(shouldIgnorePath('dist/app.js', { ignoreDist: false })).toBe(false);
    expect(shouldIgnorePath('vendor/pkg/index.php', { ignoreVendor: false })).toBe(false);
  });

  it('removes duplicate files and lines within files', () => {
    const files = [
      { path: 'data/items.txt', content: 'apple\nbanana\napple\ncherry' },
      { path: 'data/copy.txt', content: 'apple\nbanana\norange' },
      { path: 'src/utils.js', content: 'function helper() {\n  return 1;\n}\n' },
      { path: 'lib/utils.js', content: 'function helper() {\n  return 1;\n}\n' }
    ];
    const scope = {
      dedupFiles: true,
      dedupWithinFiles: true,
      dedupWithinCode: false,
      crossFileLines: true,
      detectCodeBlocks: true,
      removeCodeBlocks: false,
      preserveEntryPoints: true,
      ignoreNodeModules: true,
      ignoreGit: true,
      ignoreDist: true,
      ignoreVendor: true,
      canonicalStrategy: 'shortest',
      reportOnly: false
    };
    const result = processFolderProject(files, scope, lineOpts);
    expect(result.stats.keptFiles).toBeGreaterThanOrEqual(3);
    expect(result.stats.linesRemoved).toBeGreaterThan(0);
  });

  it('cross-file dedup respects log metadata stripping', () => {
    const engLog = loadEngines({
      checkboxDefaults: {
        'log-strip-dates': true,
        'log-strip-pids': true,
        'log-strip-levels': true
      }
    });
    const files = [
      { path: 'logs/a.log', content: '[2024-01-01] INFO Error occurred pid=1' },
      { path: 'logs/b.log', content: '[2024-01-02] INFO Error occurred pid=2' }
    ];
    const scope = {
      dedupFiles: false,
      dedupWithinFiles: true,
      dedupWithinCode: false,
      crossFileLines: true,
      detectCodeBlocks: false,
      removeCodeBlocks: false,
      preserveEntryPoints: true,
      ignoreNodeModules: true,
      ignoreGit: true,
      ignoreDist: true,
      ignoreVendor: true,
      canonicalStrategy: 'shortest',
      reportOnly: false
    };
    const result = engLog.processFolderProject(files, scope, lineOpts);
    const keptA = result.files.find((f) => f.path === 'logs/a.log');
    const keptB = result.files.find((f) => f.path === 'logs/b.log');
    const totalLines = (keptA?.content.split('\n').filter(Boolean).length || 0) +
      (keptB?.content.split('\n').filter(Boolean).length || 0);
    expect(totalLines).toBe(1);
  });

  it('cross-file dedup respects todo state stripping', () => {
    const engTodo = loadEngines({
      checkboxDefaults: { 'todo-state': true, 'todo-prefixes': true }
    });
    const files = [
      { path: 'lists/a.todo', content: '[ ] Buy eggs' },
      { path: 'lists/b.todo', content: '[x] Buy eggs' }
    ];
    const scope = {
      dedupFiles: false,
      dedupWithinFiles: false,
      dedupWithinCode: false,
      crossFileLines: true,
      detectCodeBlocks: false,
      removeCodeBlocks: false,
      preserveEntryPoints: true,
      ignoreNodeModules: true,
      ignoreGit: true,
      ignoreDist: true,
      ignoreVendor: true,
      canonicalStrategy: 'shortest',
      reportOnly: false
    };
    const result = engTodo.processFolderProject(files, scope, lineOpts);
    const totalLines = result.files.reduce((n, f) => n + f.content.split('\n').filter(Boolean).length, 0);
    expect(totalLines).toBe(1);
  });

  it('honors geckodupe:keep directives', () => {
    const files = [
      { path: 'data/keep.txt', content: 'geckodupe: keep\na\na\na' },
      { path: 'data/normal.txt', content: 'x\nx' }
    ];
    const scope = {
      dedupFiles: false,
      dedupWithinFiles: true,
      dedupWithinCode: false,
      crossFileLines: false,
      detectCodeBlocks: false,
      removeCodeBlocks: false,
      preserveEntryPoints: true,
      ignoreNodeModules: true,
      ignoreGit: true,
      ignoreDist: true,
      ignoreVendor: true,
      canonicalStrategy: 'shortest',
      reportOnly: false
    };
    const result = processFolderProject(files, scope, lineOpts);
    const kept = result.files.find((f) => f.path === 'data/keep.txt');
    expect(kept.content.split('\n').filter((l) => l === 'a').length).toBe(3);
  });

  it('cross-file fuzzy match respects similarity threshold', () => {
    const engFuzzy = loadEngines();
    const files = [
      { path: 'a.txt', content: 'the quick brown fox' },
      { path: 'b.txt', content: 'a quick brown fox runs' }
    ];
    const scope = {
      dedupFiles: false,
      dedupWithinFiles: false,
      dedupWithinCode: false,
      crossFileLines: true,
      detectCodeBlocks: false,
      removeCodeBlocks: false,
      preserveEntryPoints: true,
      ignoreNodeModules: true,
      ignoreGit: true,
      ignoreDist: true,
      ignoreVendor: true,
      canonicalStrategy: 'shortest',
      reportOnly: false
    };
    const fuzzyOpts = { ...lineOpts, simThreshold: 0.5 };
    const result = engFuzzy.processFolderProject(files, scope, fuzzyOpts);
    const totalLines = result.files.reduce((n, f) => n + f.content.split('\n').filter(Boolean).length, 0);
    expect(totalLines).toBe(1);
  });

  it('report-only mode makes no modifications', () => {
    const files = [{ path: 'dup.txt', content: 'same\nsame\nsame' }];
    const scope = {
      dedupFiles: false,
      dedupWithinFiles: true,
      dedupWithinCode: false,
      crossFileLines: false,
      detectCodeBlocks: false,
      removeCodeBlocks: false,
      preserveEntryPoints: true,
      ignoreNodeModules: true,
      ignoreGit: true,
      ignoreDist: true,
      ignoreVendor: true,
      canonicalStrategy: 'shortest',
      reportOnly: true
    };
    const result = processFolderProject(files, scope, lineOpts);
    expect(result.stats.linesRemoved).toBe(0);
    expect(result.files[0].content).toBe('same\nsame\nsame');
  });
});

describe('media variation engine', () => {
  const {
    hammingDistanceHex,
    maxHammingFromSimilarity,
    mediaSimilarityScore,
    mediaSignaturesSimilar,
    clusterMediaSignatures,
    processMediaAnalysisResults,
    isMediaPath,
    bitsToHex,
    dedupeFrameHashes,
    dimensionCompatible,
    naturalPathCompare
  } = loadEngines();

  function imgSig(dHash, aHash, exactHash, width, height) {
    return {
      kind: 'image',
      dHash: dHash,
      aHash: aHash || dHash,
      blockHash: aHash || dHash,
      scales: [dHash, aHash || dHash],
      exactHash: exactHash || dHash,
      width: width || 1920,
      height: height || 1080,
      byteSize: 1000
    };
  }

  it('detects media paths', () => {
    expect(isMediaPath('photos/a.jpg')).toBe(true);
    expect(isMediaPath('clip.mp4')).toBe(true);
    expect(isMediaPath('readme.txt')).toBe(false);
  });

  it('skips thumbnail and macOS metadata paths when configured', () => {
    const { shouldIgnoreMediaPath } = loadEngines();
    expect(shouldIgnoreMediaPath('album/thumbs/photo.jpg', { skipThumbs: true, skipDsStore: false })).toBe(true);
    expect(shouldIgnoreMediaPath('album/__MACOSX/photo.jpg', { skipThumbs: false, skipDsStore: true })).toBe(true);
    expect(shouldIgnoreMediaPath('album/photo.jpg', { skipThumbs: true, skipDsStore: true })).toBe(false);
  });

  it('natural-sorts burst frame paths', () => {
    expect(naturalPathCompare('frame2.jpg', 'frame10.jpg')).toBeLessThan(0);
    expect(naturalPathCompare('frame10.jpg', 'frame2.jpg')).toBeGreaterThan(0);
  });

  it('computes hamming distance between hashes', () => {
    expect(hammingDistanceHex('ffff', 'ffff')).toBe(0);
    expect(hammingDistanceHex('0000', 'ffff')).toBeGreaterThan(0);
  });

  it('maps similarity slider to hamming tolerance', () => {
    expect(maxHammingFromSimilarity(100)).toBe(0);
    expect(maxHammingFromSimilarity(92)).toBe(5);
    expect(maxHammingFromSimilarity(85)).toBeGreaterThan(maxHammingFromSimilarity(92));
  });

  it('scores identical signatures at 100%', () => {
    var hash = bitsToHex('1111000011110000111100001111000011110000111100001111000011110000');
    var a = imgSig(hash);
    var b = imgSig(hash, hash, 'unique-bytes');
    expect(mediaSimilarityScore(a, b, { similarity: 92 })).toBeGreaterThan(0.9);
  });

  it('rejects wildly different dimensions when resize not allowed', () => {
    var hash = bitsToHex('1111000011110000111100001111000011110000111100001111000011110000');
    var a = imgSig(hash, hash, 'a', 1920, 1080);
    var b = imgSig(hash, hash, 'b', 900, 500);
    expect(dimensionCompatible(a, b, { allowResize: false })).toBe(false);
    expect(dimensionCompatible(a, b, { allowResize: true })).toBe(true);
    var thumb = imgSig(hash, hash, 'c', 64, 64);
    expect(dimensionCompatible(a, thumb, { allowResize: true })).toBe(true);
  });

  it('clusters identical perceptual signatures', () => {
    var hash = bitsToHex('1010101010101010101010101010101010101010101010101010101010101010');
    var items = [
      { path: 'a/1.jpg', sig: imgSig(hash) },
      { path: 'b/copy.png', sig: imgSig(hash) },
      { path: 'c/other.jpg', sig: imgSig(bitsToHex('0101010101010101010101010101010101010101010101010101010101010101')) }
    ];
    var clusters = clusterMediaSignatures(items, { similarity: 92 });
    var multi = clusters.filter(function(c) { return c.length > 1; });
    expect(multi.length).toBe(1);
    expect(multi[0].length).toBe(2);
  });

  it('dedupes near-identical video frame hashes', () => {
    var h1 = bitsToHex('1111000011110000111100001111000011110000111100001111000011110000');
    var h2 = bitsToHex('1111000011110000111100001111000011110000111100001111000011110001');
    var unique = dedupeFrameHashes([h1, h2, h1], 2);
    expect(unique.length).toBeLessThan(3);
  });

  it('scores hue histogram similarity with bhattacharyya and chi-square blend', () => {
    const { bhattacharyyaCoeff, hueHistogramSimilarity } = loadEngines();
    var warm = [0.6, 0.2, 0.05, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.01, 0.01, 0.01];
    var cool = [0.02, 0.02, 0.02, 0.05, 0.05, 0.1, 0.15, 0.2, 0.15, 0.1, 0.08, 0.06];
    expect(bhattacharyyaCoeff(warm, warm)).toBeCloseTo(1, 5);
    expect(hueHistogramSimilarity(warm, cool)).toBeLessThan(0.55);
  });

  it('matches near-duplicate videos with aligned frame profiles', () => {
    const { bandedDtwVideoSimilarity, mediaSignaturesSimilar, maxHammingFromSimilarity } = loadEngines();
    var hash = bitsToHex('1111000011110000111100001111000011110000111100001111000011110000');
    var hue = [0.4, 0.15, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05];
    function frame(t, luma) {
      return {
        dHash: hash,
        colorHash: hash,
        detailHash: hash,
        hueHist: hue,
        luma: luma,
        contrast: 0.2,
        saturation: 0.3,
        t: t
      };
    }
    var profilesA = [frame(0, 0.4), frame(0.5, 0.45), frame(1, 0.42)];
    var profilesB = [frame(0, 0.41), frame(0.5, 0.44), frame(1, 0.43)];
    var dtw = bandedDtwVideoSimilarity(profilesA, profilesB, { similarity: 92 });
    expect(dtw).toBeGreaterThan(0.85);

    var sigA = {
      kind: 'video',
      frameProfiles: profilesA,
      uniqueFrameProfiles: profilesA,
      aggregateHue: hue,
      meanLuma: 0.42,
      meanSaturation: 0.3,
      duration: 10,
      width: 1920,
      height: 1080,
      dHash: hash,
      frameHashes: [hash],
      uniqueFrameHashes: [hash]
    };
    var sigB = {
      kind: 'video',
      frameProfiles: profilesB,
      uniqueFrameProfiles: profilesB,
      aggregateHue: hue,
      meanLuma: 0.43,
      meanSaturation: 0.3,
      duration: 10,
      width: 1920,
      height: 1080,
      dHash: hash,
      frameHashes: [hash],
      uniqueFrameHashes: [hash]
    };
    expect(mediaSignaturesSimilar(sigA, sigB, maxHammingFromSimilarity(92), { similarity: 92, allowResize: true })).toBe(true);
  });

  it('rejects videos with different color dominance', () => {
    const { mediaSignaturesSimilar, maxHammingFromSimilarity } = loadEngines();
    var hash = bitsToHex('1111000011110000111100001111000011110000111100001111000011110000');
    var warm = [0.6, 0.2, 0.05, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.01, 0.01, 0.01];
    var cool = [0.02, 0.02, 0.02, 0.05, 0.05, 0.1, 0.15, 0.2, 0.15, 0.1, 0.08, 0.06];
    function sig(hue, luma) {
      var frame = {
        dHash: hash,
        colorHash: hash,
        detailHash: hash,
        hueHist: hue,
        luma: luma,
        contrast: 0.2,
        saturation: 0.35,
        t: 0
      };
      return {
        kind: 'video',
        frameProfiles: [frame],
        uniqueFrameProfiles: [frame],
        aggregateHue: hue,
        meanLuma: luma,
        meanSaturation: 0.35,
        duration: 8,
        width: 1280,
        height: 720,
        dHash: hash,
        frameHashes: [hash],
        uniqueFrameHashes: [hash]
      };
    }
    var warmSig = sig(warm, 0.35);
    var coolSig = sig(cool, 0.7);
    expect(mediaSignaturesSimilar(warmSig, coolSig, maxHammingFromSimilarity(92), { similarity: 92, allowResize: true })).toBe(false);
  });

  it('removes variation duplicates from analyzed set', () => {
    var hash = bitsToHex('1111000011110000111100001111000011110000111100001111000011110000');
    var analyzed = [
      { path: 'burst/frame001.jpg', binaryData: new ArrayBuffer(8), sig: imgSig(hash, hash, 'aaa') },
      { path: 'burst/frame002.jpg', binaryData: new ArrayBuffer(8), sig: imgSig(hash, hash, 'bbb') },
      { path: 'unique/photo.jpg', binaryData: new ArrayBuffer(8), sig: imgSig(bitsToHex('0000111100001111000011110000111100001111000011110000111100001111')) }
    ];
    var result = processMediaAnalysisResults([], analyzed, {
      similarity: 92,
      collapseBursts: true,
      maxBurstKeep: 1,
      keepLargest: false,
      allowResize: true
    });
    expect(result.stats.filesRemoved).toBeGreaterThan(0);
    expect(result.stats.keptFiles).toBeLessThan(3);
    expect(result.stats.burstClusters + result.clusters.length).toBeGreaterThan(0);
    expect(result.previewGroups && result.previewGroups.length).toBeGreaterThan(0);
  });

  it('matches signatures when similarity is high enough', () => {
    var hash = bitsToHex('1111000011110000111100001111000011110000111100001111000011110000');
    var a = imgSig(hash);
    var b = imgSig(hash, hash, 'other');
    expect(mediaSignaturesSimilar(a, b, 5, { similarity: 90 })).toBe(true);
  });

  it('rejects different-looking images even when one hash is close', () => {
    var hashA = bitsToHex('1111000011110000111100001111000011110000111100001111000011110000');
    var hashB = bitsToHex('1111000011110000111100001111000011110000111100001111000011110001');
    var colorA = bitsToHex('1010101010101010101010101010101010101010101010101010101010101010');
    var colorB = bitsToHex('0101010101010101010101010101010101010101010101010101010101010101');
    var a = {
      kind: 'image',
      dHash: hashA,
      aHash: colorA,
      blockHash: hashA,
      detailHash: hashA,
      colorHash: colorA,
      exactHash: 'a',
      width: 1920,
      height: 1080,
      byteSize: 1000
    };
    var b = {
      kind: 'image',
      dHash: hashA,
      aHash: colorB,
      blockHash: hashB,
      detailHash: hashB,
      colorHash: colorB,
      exactHash: 'b',
      width: 1920,
      height: 1080,
      byteSize: 1000
    };
    expect(mediaSignaturesSimilar(a, b, maxHammingFromSimilarity(92), { similarity: 92 })).toBe(false);
  });

  it('at 100% similarity only matches identical bytes', () => {
    var hash = bitsToHex('1111000011110000111100001111000011110000111100001111000011110000');
    var sameBytes = imgSig(hash, hash, 'same-hash');
    var diffBytes = imgSig(hash, hash, 'different-hash');
    expect(mediaSignaturesSimilar(sameBytes, diffBytes, 0, { similarity: 100 })).toBe(false);
    expect(mediaSignaturesSimilar(sameBytes, imgSig(hash, hash, 'same-hash'), 0, { similarity: 100 })).toBe(true);
  });

  it('reference target mode keeps target and removes only its variations', () => {
    var hash = bitsToHex('1111000011110000111100001111000011110000111100001111000011110000');
    var other = bitsToHex('0000111100001111000011110000111100001111000011110000111100001111');
    var analyzed = [
      { path: 'target.jpg', binaryData: new ArrayBuffer(8), sig: imgSig(hash, hash, 'target') },
      { path: 'copy1.jpg', binaryData: new ArrayBuffer(8), sig: imgSig(hash, hash, 'copy1') },
      { path: 'copy2.jpg', binaryData: new ArrayBuffer(8), sig: imgSig(hash, hash, 'copy2') },
      { path: 'other.jpg', binaryData: new ArrayBuffer(8), sig: imgSig(other) }
    ];
    var result = processMediaAnalysisResults([], analyzed, {
      similarity: 92,
      useTargetReference: true,
      targetPath: 'target.jpg',
      targetSig: analyzed[0].sig,
      targetBinary: analyzed[0].binaryData,
      allowResize: true
    });
    expect(result.stats.targetMode).toBe(true);
    expect(result.stats.filesRemoved).toBe(2);
    expect(result.stats.keptFiles).toBe(2);
    expect(result.files.some(function(f) { return f.path === 'target.jpg'; })).toBe(true);
    expect(result.files.some(function(f) { return f.path === 'other.jpg'; })).toBe(true);
    expect(result.files.some(function(f) { return f.path === 'copy1.jpg'; })).toBe(false);
    expect(result.clusters[0].kept).toBe('target.jpg');
  });

  it('target mode does not dedupe among non-target files', () => {
    var hashA = bitsToHex('1111000011110000111100001111000011110000111100001111000011110000');
    var hashB = bitsToHex('0000111100001111000011110000111100001111000011110000111100001111');
    var analyzed = [
      { path: 'target.jpg', binaryData: new ArrayBuffer(8), sig: imgSig(hashA, hashA, 'target') },
      { path: 'target-copy.jpg', binaryData: new ArrayBuffer(8), sig: imgSig(hashA, hashA, 'copy') },
      { path: 'burst1.jpg', binaryData: new ArrayBuffer(8), sig: imgSig(hashB, hashB, 'b1') },
      { path: 'burst2.jpg', binaryData: new ArrayBuffer(8), sig: imgSig(hashB, hashB, 'b2') }
    ];
    var result = processMediaAnalysisResults([], analyzed, {
      similarity: 92,
      useTargetReference: true,
      targetPath: 'target.jpg',
      targetSig: analyzed[0].sig,
      targetBinary: analyzed[0].binaryData,
      allowResize: true
    });
    expect(result.stats.filesRemoved).toBe(1);
    expect(result.files.some(function(f) { return f.path === 'burst1.jpg'; })).toBe(true);
    expect(result.files.some(function(f) { return f.path === 'burst2.jpg'; })).toBe(true);
  });

  it('external target is kept when not present in analyzed set', () => {
    var hash = bitsToHex('1010101010101010101010101010101010101010101010101010101010101010');
    var externalSig = imgSig(hash, hash, 'ext');
    var analyzed = [
      { path: 'dup.jpg', binaryData: new ArrayBuffer(8), sig: imgSig(hash, hash, 'dup') }
    ];
    var result = processMediaAnalysisResults([], analyzed, {
      similarity: 92,
      useTargetReference: true,
      targetPath: 'external/ref.jpg',
      targetSig: externalSig,
      targetBinary: new ArrayBuffer(8),
      allowResize: true
    });
    expect(result.stats.filesRemoved).toBe(1);
    expect(result.files.some(function(f) { return f.path === 'external/ref.jpg'; })).toBe(true);
    expect(result.files.some(function(f) { return f.path === 'dup.jpg'; })).toBe(false);
  });

  it('keeps passthrough files in output unchanged', () => {
    var hash = bitsToHex('1111000011110000111100001111000011110000111100001111000011110000');
    var analyzed = [
      { path: 'a.jpg', binaryData: new ArrayBuffer(4), sig: imgSig(hash, hash, 'a') },
      { path: 'b.jpg', binaryData: new ArrayBuffer(4), sig: imgSig(hash, hash, 'b') }
    ];
    var passthrough = [
      { path: 'keep/raw.jpg', binaryData: new ArrayBuffer(4), passthrough: true, skip: true }
    ];
    var result = processMediaAnalysisResults(passthrough, analyzed, {
      similarity: 92,
      collapseBursts: false,
      keepLargest: true,
      allowResize: true
    });
    expect(result.stats.passthroughFiles).toBe(1);
    expect(result.files.some((f) => f.path === 'keep/raw.jpg')).toBe(true);
  });

  it('verifies media result stats', () => {
    const { verifyMediaResult } = loadEngines();
    var before = [
      { path: 'a.jpg', binaryData: new ArrayBuffer(4) },
      { path: 'b.jpg', binaryData: new ArrayBuffer(4) }
    ];
    var result = {
      files: [{ path: 'a.jpg', binaryData: new ArrayBuffer(4) }],
      stats: { keptFiles: 1, filesRemoved: 1, errors: 0 }
    };
    expect(verifyMediaResult(before, result, { similarity: 92 }).passed).toBe(true);
  });
});

describe('excel engine', () => {
  const eng = loadEngines({ withXlsx: true, checkboxDefaults: { 'csv-header': true } });
  const { excelBufferToCsv, csvToExcelBuffer, processExcel } = eng;

  it('converts buffer to csv and back', () => {
    const buf = new Uint8Array([1, 2, 3]);
    const csv = excelBufferToCsv(buf.buffer || buf);
    expect(csv).toContain('name,value');
    const out = csvToExcelBuffer(csv, 'Sheet1');
    expect(out).toBeInstanceOf(Uint8Array);
  });

  it('processes excel via csv pipeline', () => {
    const csv = 'h1,h2\na,b\na,b';
    const r = processExcel(csv, ...lineArgs(opts));
    expect(r.remaining).toBe(2);
  });
});
