var FOLDER_ENTRY_NAMES = ['index', 'main', 'app', '__init__', 'mod'];
var FOLDER_CODE_EXTS = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.py', '.java', '.cpp', '.c', '.h', '.go', '.rs', '.rb', '.php', '.sh', '.css', '.html', '.vue', '.svelte'];
var FOLDER_SKIP_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.mp3', '.mp4', '.pdf', '.exe', '.dll', '.so', '.dylib', '.zip', '.gz', '.tar', '.7z', '.wasm', '.map'];
var FOLDER_GECKO_KEEP_FILE = /geckodupe:\s*keep\b/i;
var FOLDER_GECKO_KEEP_LINE = /geckodupe:\s*keep-line\b/i;
var FOLDER_GECKO_KEEP_SECTION = /geckodupe:\s*keep-section\b/i;
var FOLDER_TEST_PATTERNS = [/\.test\./i, /\.spec\./i, /^test_/i, /\/tests?\//i, /\\tests?\\/i];

function detectFormatFromPath(path, content) {
  var sniffed = sniffFormat(path || '', content || '');
  if (sniffed.mode && sniffed.mode !== 'skip') return sniffed.mode;
  var lower = (path || '').toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'excel';
  if (lower.endsWith('.csv') || lower.endsWith('.tsv')) return 'csv';
  if (lower.endsWith('.json') || lower.endsWith('.jsonl') || lower.endsWith('.yaml') || lower.endsWith('.yml') || lower.endsWith('.xml')) return 'json';
  if (lower.endsWith('.log') || lower.endsWith('.sql')) return 'log';
  if (lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.rst') || lower.endsWith('.adoc')) return 'txt';
  var codeExts = typeof GECKO_CODE_EXTENSIONS !== 'undefined' ? GECKO_CODE_EXTENSIONS : FOLDER_CODE_EXTS;
  if (codeExts.some(function(ext) { return lower.endsWith(ext); })) return 'code';
  if (lower.endsWith('.todo') || lower.endsWith('.list') || lower.endsWith('.task')) return 'todo';
  return 'txt';
}

function isCodeFormat(fmt) { return fmt === 'code'; }

function isDataFormat(fmt) {
  return fmt === 'txt' || fmt === 'csv' || fmt === 'json' || fmt === 'log' || fmt === 'todo' || fmt === 'excel';
}

function normalizePath(p) {
  return p.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/');
}

function shouldIgnorePath(path, scopeOpts) {
  var parts = normalizePath(path).split('/');
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i].toLowerCase();
    if (!part || part === '.') continue;
    if (scopeOpts.ignoreNodeModules && part === 'node_modules') return true;
    if (scopeOpts.ignoreGit && (part === '.git' || part === '.svn' || part === '.hg')) return true;
    if (scopeOpts.ignoreDist && (part === 'dist' || part === 'build' || part === '.next' || part === 'coverage' || part === 'out')) return true;
    if (scopeOpts.ignoreVendor && (part === 'vendor' || part === '__pycache__' || part === '.cache')) return true;
  }
  return false;
}

function parseManualSkips(text) {
  if (!text || !String(text).trim()) return [];
  var seen = {};
  var list = [];
  String(text).split(/\r?\n/).forEach(function(line) {
    var t = line.trim();
    if (!t || t.charAt(0) === '#') return;
    var lower = t.toLowerCase();
    if (seen[lower]) return;
    seen[lower] = true;
    list.push(lower);
  });
  return list;
}

function escapeGlobRegex(s) {
  return s.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
}

function compileManualSkips(rawList) {
  if (!rawList || !rawList.length) return null;
  var segments = [];
  var pathRules = [];
  var globRules = [];
  for (var i = 0; i < rawList.length; i++) {
    var p = rawList[i];
    if (p.indexOf('*') !== -1) {
      globRules.push(new RegExp('^' + escapeGlobRegex(p) + '$', 'i'));
    } else if (p.indexOf('/') !== -1) {
      pathRules.push(p);
    } else {
      segments.push(p);
    }
  }
  if (!segments.length && !pathRules.length && !globRules.length) return null;
  return { segments: segments, pathRules: pathRules, globRules: globRules };
}

function matchesManualSkip(path, compiled) {
  if (!compiled) return false;
  var norm = normalizePath(path).toLowerCase();
  var parts = norm.split('/');
  var base = parts[parts.length - 1] || '';
  var i, j, rule;
  for (i = 0; i < compiled.segments.length; i++) {
    var seg = compiled.segments[i];
    if (base === seg) return true;
    for (j = 0; j < parts.length - 1; j++) {
      if (parts[j] === seg) return true;
    }
  }
  for (i = 0; i < compiled.pathRules.length; i++) {
    rule = compiled.pathRules[i];
    if (norm === rule || norm.indexOf(rule + '/') === 0 || norm.endsWith('/' + rule) || norm.indexOf('/' + rule + '/') !== -1) return true;
  }
  for (i = 0; i < compiled.globRules.length; i++) {
    if (compiled.globRules[i].test(base) || compiled.globRules[i].test(norm)) return true;
  }
  return false;
}

function isSkippedExtension(path) {
  var lower = path.toLowerCase();
  return FOLDER_SKIP_EXTS.some(function(ext) { return lower.endsWith(ext); });
}

function isEntryPointFile(path) {
  var base = path.split('/').pop().split('.')[0].toLowerCase();
  return FOLDER_ENTRY_NAMES.indexOf(base) !== -1;
}

function isTestFile(path) {
  return FOLDER_TEST_PATTERNS.some(function(re) { return re.test(path); });
}

function simpleHash(str) {
  var h = 2166136261;
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function getBasename(path) {
  return path.split('/').pop();
}

function pickCanonicalFile(files, strategy) {
  var sorted = files.slice().filter(function(f) { return !f.skip && !f.deleted; }).sort(function(a, b) {
    if (strategy === 'shortest') {
      var d = a.path.length - b.path.length;
      if (d !== 0) return d;
    }
    return a.path.localeCompare(b.path);
  });
  return sorted[0] || files[0];
}

function prepareExcelFile(file) {
  if (!file.binary || !file.binaryData || file.format !== 'excel') return;
  if (typeof excelBufferToCsv !== 'function') {
    file.error = 'Excel support unavailable';
    return;
  }
  try {
    file.content = excelBufferToCsv(file.binaryData);
    file.excelSheet = getBasename(file.path).replace(/\.[^.]+$/, '') || 'Sheet1';
    file.hash = simpleHash(file.content || '');
  } catch (e) {
    file.error = 'Could not read Excel: ' + e.message;
  }
}

function finalizeExcelFile(file) {
  if (file.format !== 'excel' || !file.modified || !file.content) return;
  if (typeof csvToExcelBuffer !== 'function') return;
  try {
    file.binaryData = csvToExcelBuffer(file.content, file.excelSheet);
    file.binary = true;
  } catch (e) {
    file.error = 'Could not write Excel: ' + e.message;
  }
}

function processFileLines(content, format, lineOpts, filePath) {
  try {
    if (format === 'code') {
      var o = lineOpts;
      return processCode(content, o.doStack, o.doCaps, o.doBlanks, o.sortOrder, o.simThreshold, o.filterMode, o.ignorePunct, o.collapseWs, filePath);
    }
    return invokeTextEngine(content, format, lineOpts);
  } catch (e) {
    return { lines: [], total: 0, removed: 0, remaining: 0, error: e.message };
  }
}

function extractCodeBlocks(content, path) {
  var lines = content.split('\n');
  var blocks = [];
  var ext = (path.split('.').pop() || '').toLowerCase();
  var starters = ext === 'py'
    ? [/^\s*(?:async\s+)?def\s+([A-Za-z_][\w]*)\s*\(/, /^\s*class\s+([A-Za-z_][\w]*)/]
    : [/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/, /^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/];

  for (var i = 0; i < lines.length; i++) {
    if (FOLDER_GECKO_KEEP_SECTION.test(lines[i])) continue;
    var matched = null;
    for (var s = 0; s < starters.length; s++) {
      var m = lines[i].match(starters[s]);
      if (m) { matched = { name: m[1] }; break; }
    }
    if (!matched) continue;

    var start = i;
    var end = i;
    if (ext === 'py') {
      var baseIndent = (lines[i].match(/^\s*/) || [''])[0].length;
      for (var j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() === '') { end = j; continue; }
        if (((lines[j].match(/^\s*/) || [''])[0].length) <= baseIndent && lines[j].trim() !== '') break;
        end = j;
      }
    } else {
      var brace = 0;
      var found = false;
      for (var k = i; k < lines.length; k++) {
        for (var c = 0; c < lines[k].length; c++) {
          if (lines[k][c] === '{') { brace++; found = true; }
          if (lines[k][c] === '}') brace--;
        }
        end = k;
        if (found && brace <= 0) break;
      }
    }

    var body = lines.slice(start, end + 1).join('\n');
    var norm = body.replace(/\s+/g, ' ').trim();
    if (norm.length < 16) continue;
    blocks.push({ name: matched.name, start: start, end: end, body: body, norm: norm });
  }
  return blocks;
}

function isIntentionalCodeDuplicate(blockA, blockB, fileA, fileB, scopeOpts) {
  if (blockA.name !== blockB.name) return true;
  if (isTestFile(fileA.path) || isTestFile(fileB.path)) return true;
  if (scopeOpts.preserveEntryPoints && (isEntryPointFile(fileA.path) || isEntryPointFile(fileB.path))) return true;
  if (fileA.path.split('/').slice(0, -1).join('/') !== fileB.path.split('/').slice(0, -1).join('/')) return true;
  return false;
}

function deduplicateFilesPass(files, scopeOpts, report, stats) {
  if (scopeOpts.reportOnly || !scopeOpts.dedupFiles) return;
  var groups = {};
  files.forEach(function(f) {
    if (f.skip || f.deleted || f.error || !f.hash) return;
    if (!groups[f.hash]) groups[f.hash] = [];
    groups[f.hash].push(f);
  });

  Object.keys(groups).forEach(function(hash) {
    var group = groups[hash];
    if (group.length < 2) return;
    stats.duplicateFileGroups++;

    var byBase = {};
    group.forEach(function(f) {
      var b = getBasename(f.path).toLowerCase();
      if (!byBase[b]) byBase[b] = [];
      byBase[b].push(f.path.split('/').slice(0, -1).join('/'));
    });
    var intentional = Object.keys(byBase).some(function(b) {
      var dirs = byBase[b];
      return dirs.length > 1 && new Set(dirs).size > 1;
    });
    if (intentional) {
      report.push('Kept ' + group.length + ' identical files (same name, different folders)');
      return;
    }

    var eligible = group.filter(function(f) {
      return !f.skip && !(scopeOpts.preserveEntryPoints && isEntryPointFile(f.path));
    });
    if (eligible.length < 2) {
      report.push('Kept ' + group.length + ' identical files (entry points protected)');
      return;
    }

    var canonical = pickCanonicalFile(eligible, scopeOpts.canonicalStrategy);
    eligible.forEach(function(f) {
      if (f === canonical) return;
      f.deleted = true;
      stats.filesRemoved++;
      report.push('Removed duplicate file: ' + f.path + ' (kept ' + canonical.path + ')');
    });
  });
}

function deduplicateWithinFilesPass(files, scopeOpts, lineOpts, report, stats) {
  if (scopeOpts.reportOnly || !scopeOpts.dedupWithinFiles) return;

  files.forEach(function(f) {
    if (f.skip || f.deleted || f.error || !f.content) return;
    if (FOLDER_GECKO_KEEP_FILE.test(f.content)) {
      f.skip = true;
      report.push('Skipped (keep): ' + f.path);
      return;
    }

    var process = isDataFormat(f.format) || (scopeOpts.dedupWithinCode && isCodeFormat(f.format));
    if (!process) return;

    var result = processFileLines(f.content, f.format, lineOpts, f.path);
    if (result.error) {
      f.error = result.error;
      stats.errors++;
      report.push('Error in ' + f.path + ': ' + result.error);
      return;
    }
    if (result.removed > 0) {
      f.content = result.lines.join('\n');
      f.hash = simpleHash(f.content);
      f.modified = true;
      stats.linesRemoved += result.removed;
      stats.filesModified++;
      report.push(f.path + ': removed ' + result.removed + ' duplicate line(s)');
    }
  });
}

function deduplicateCrossFileLinesPass(files, scopeOpts, lineOpts, report, stats) {
  if (scopeOpts.reportOnly || !scopeOpts.crossFileLines) return;

  var sorted = files.slice().sort(function(a, b) { return a.path.localeCompare(b.path); });
  var globalKeys = {};
  var globalEntries = [];

  sorted.forEach(function(f) {
    if (f.skip || f.deleted || f.error || !f.content || !isDataFormat(f.format) || isCodeFormat(f.format)) return;

    var lines = f.content.split('\n');
    var out = [];
    var fileRemoved = 0;
    var useFuzzy = lineOpts.simThreshold < 1;

    for (var i = 0; i < lines.length; i++) {
      if (FOLDER_GECKO_KEEP_LINE.test(lines[i]) || (i > 0 && FOLDER_GECKO_KEEP_LINE.test(lines[i - 1]))) {
        out.push(lines[i]);
        continue;
      }
      var raw = lines[i];
      if (!lineOpts.doBlanks && raw.trim() === '') {
        out.push(raw);
        continue;
      }
      var key = lineComparisonKey(raw, f.format, lineOpts);
      if (!key) {
        out.push(raw);
        continue;
      }

      var isDuplicate = false;
      if (!useFuzzy) {
        if (globalKeys[key]) isDuplicate = true;
      } else {
        var keySet = getWordSet(key);
        var bestSim = -1;
        for (var g = 0; g < globalEntries.length; g++) {
          if (key === globalEntries[g].key) {
            bestSim = 1;
            break;
          }
          var sim = calculateSimilarityCached(key, globalEntries[g].key, keySet, globalEntries[g].wordSet);
          if (sim > bestSim) bestSim = sim;
        }
        if (bestSim >= lineOpts.simThreshold) isDuplicate = true;
      }

      if (isDuplicate) {
        fileRemoved++;
        continue;
      }

      globalKeys[key] = f.path;
      if (useFuzzy) {
        globalEntries.push({ key: key, wordSet: getWordSet(key) });
      }
      out.push(raw);
    }

    if (fileRemoved > 0) {
      f.content = out.join('\n');
      f.hash = simpleHash(f.content);
      f.modified = true;
      stats.linesRemoved += fileRemoved;
      stats.filesModified++;
      report.push(f.path + ': removed ' + fileRemoved + ' cross-file duplicate line(s)');
    }
  });
}

function analyzeCodeBlocksPass(files, scopeOpts, report, stats) {
  if (!scopeOpts.detectCodeBlocks) return;

  var allBlocks = [];
  files.forEach(function(f) {
    if (f.skip || f.deleted || f.error || !isCodeFormat(f.format) || !f.content) return;
    if (FOLDER_GECKO_KEEP_FILE.test(f.content)) return;
    extractCodeBlocks(f.content, f.path).forEach(function(b) {
      b.file = f;
      allBlocks.push(b);
    });
  });

  var byNorm = {};
  allBlocks.forEach(function(b) {
    if (!byNorm[b.norm]) byNorm[b.norm] = [];
    byNorm[b.norm].push(b);
  });

  Object.keys(byNorm).forEach(function(norm) {
    var group = byNorm[norm];
    if (group.length < 2) return;

    var intentional = false;
    for (var i = 0; i < group.length && !intentional; i++) {
      for (var j = i + 1; j < group.length; j++) {
        if (isIntentionalCodeDuplicate(group[i], group[j], group[i].file, group[j].file, scopeOpts)) {
          intentional = true;
          break;
        }
      }
    }

    if (intentional) {
      stats.intentionalCodeBlocks++;
      if (scopeOpts.reportOnly || !scopeOpts.removeCodeBlocks) {
        report.push('Intentional duplicate code: ' + group[0].name + ' in ' + group.map(function(g) { return g.file.path; }).join(', '));
      }
      return;
    }

    stats.duplicateCodeBlocks++;
    report.push('Duplicate code: ' + group[0].name + ' (' + group.length + 'x) at ' + group.map(function(g) { return g.file.path + ':' + (g.start + 1); }).join(', '));

    if (!scopeOpts.removeCodeBlocks || scopeOpts.reportOnly) return;

    var canonical = group[0];
    for (var r = 1; r < group.length; r++) {
      var block = group[r];
      var file = block.file;
      if (file.skip || file.deleted || isTestFile(file.path)) continue;
      var lines = file.content.split('\n');
      var keep = false;
      for (var li = block.start; li <= block.end; li++) {
        if (FOLDER_GECKO_KEEP_SECTION.test(lines[li]) || FOLDER_GECKO_KEEP_LINE.test(lines[li])) keep = true;
      }
      if (keep) continue;
      lines.splice(block.start, block.end - block.start + 1);
      file.content = lines.join('\n');
      file.hash = simpleHash(file.content);
      file.modified = true;
      stats.filesModified++;
      report.push('Removed duplicate ' + block.name + ' from ' + file.path + ' (kept ' + canonical.file.path + ')');
    }
  });
}

function processFolderProject(files, scopeOpts, lineOpts) {
  var report = [];
  var stats = {
    totalFiles: 0,
    filesRemoved: 0,
    filesModified: 0,
    linesRemoved: 0,
    duplicateFileGroups: 0,
    duplicateCodeBlocks: 0,
    intentionalCodeBlocks: 0,
    errors: 0,
    skippedPaths: 0,
    passthroughFiles: 0
  };

  var working = [];
  files.forEach(function(f) {
    var path = normalizePath(f.path);
    if (shouldIgnorePath(path, scopeOpts)) {
      stats.skippedPaths++;
      return;
    }
    if (isSkippedExtension(path)) {
      stats.skippedPaths++;
      return;
    }
    var entry = {
      path: path,
      content: f.content,
      binary: !!f.binary,
      binaryData: f.binaryData || null,
      format: f.format || detectFormatFromPath(path, f.content),
      hash: null,
      skip: false,
      deleted: false,
      modified: false,
      error: null,
      excelSheet: null
    };
    if (entry.binary && entry.format === 'excel') {
      prepareExcelFile(entry);
    } else if (!entry.binary) {
      entry.hash = simpleHash(entry.content || '');
    }
    if (scopeOpts.manualSkipsCompiled && matchesManualSkip(path, scopeOpts.manualSkipsCompiled)) {
      entry.skip = true;
      stats.passthroughFiles++;
    }
    working.push(entry);
  });

  working.sort(function(a, b) { return a.path.localeCompare(b.path); });
  stats.totalFiles = working.length;
  report.push('Scanned ' + stats.totalFiles + ' file(s)' + (stats.skippedPaths ? ' (' + stats.skippedPaths + ' paths skipped)' : ''));
  if (stats.passthroughFiles) {
    report.push('Left unchanged: ' + stats.passthroughFiles + ' file(s) matched your skip list');
  }

  deduplicateFilesPass(working, scopeOpts, report, stats);
  deduplicateWithinFilesPass(working, scopeOpts, lineOpts, report, stats);
  deduplicateCrossFileLinesPass(working, scopeOpts, lineOpts, report, stats);
  analyzeCodeBlocksPass(working, scopeOpts, report, stats);

  working.forEach(function(f) {
    if (f.modified && f.format === 'excel') finalizeExcelFile(f);
  });

  var kept = working.filter(function(f) { return !f.deleted; });
  stats.keptFiles = kept.length;

  return {
    files: kept,
    allFiles: working,
    report: report,
    stats: stats
  };
}

function buildFolderReportText(result, elapsedMs, modeLabel) {
  var s = result.stats;
  var lines = [];
  lines.push('Mode: ' + (modeLabel || 'safe'));
  lines.push('');
  if (s.filesRemoved || s.linesRemoved || s.duplicateCodeBlocks) {
    if (s.filesRemoved) lines.push('Duplicate files removed: ' + s.filesRemoved);
    if (s.linesRemoved) lines.push('Duplicate lines removed: ' + s.linesRemoved);
    if (s.filesModified) lines.push('Files modified: ' + s.filesModified);
    if (s.duplicateCodeBlocks) lines.push('Duplicate code blocks found: ' + s.duplicateCodeBlocks);
    if (s.intentionalCodeBlocks) lines.push('Intentional duplicates kept: ' + s.intentionalCodeBlocks);
  } else {
    lines.push('No duplicates removed.');
  }
  if (s.errors) lines.push('Errors: ' + s.errors);
  lines.push('Completed in ' + elapsedMs + 'ms');
  lines.push('');
  var changes = result.report.filter(function(r) {
    return r.indexOf('Removed') === 0 || r.indexOf(': removed') !== -1 || r.indexOf('Duplicate') === 0 || r.indexOf('Error') === 0;
  });
  if (changes.length) {
    lines.push('Details:');
    changes.slice(0, 80).forEach(function(r) { lines.push('  ' + r); });
    if (changes.length > 80) lines.push('  ... +' + (changes.length - 80) + ' more');
  }
  return lines.join('\n');
}

function buildFolderManifest(files, projectName) {
  if (!files.length) return '';
  var lines = [(projectName || 'project') + '/  (' + files.length + ' files)'];
  var n = Math.min(files.length, 20);
  for (var i = 0; i < n; i++) {
    lines.push(files[i].path);
  }
  if (files.length > n) lines.push('... +' + (files.length - n) + ' more files');
  return lines.join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    processFolderProject: processFolderProject,
    detectFormatFromPath: detectFormatFromPath,
    normalizePath: normalizePath,
    shouldIgnorePath: shouldIgnorePath,
    isSkippedExtension: isSkippedExtension,
    parseManualSkips: parseManualSkips,
    compileManualSkips: compileManualSkips,
    matchesManualSkip: matchesManualSkip,
    buildFolderManifest: buildFolderManifest
  };
}
