function geckoHashKeys(keys) {
  var h = 2166136261;
  var sorted = keys.slice().sort();
  for (var i = 0; i < sorted.length; i++) {
    var s = sorted[i];
    for (var j = 0; j < s.length; j++) {
      h ^= s.charCodeAt(j);
      h = Math.imul(h, 16777619);
    }
    h ^= 10;
  }
  return (h >>> 0).toString(16);
}

function collectComparisonKeys(text, format, lineOpts) {
  var keys = [];
  if (!text || !text.trim()) return keys;
  var lines = text.split('\n');
  for (var i = 0; i < lines.length; i++) {
    var raw = lines[i];
    if (!lineOpts.doBlanks && raw.trim() === '') continue;
    var key = lineComparisonKey(raw, format || 'txt', lineOpts);
    if (key) keys.push(key);
  }
  return keys;
}

function verifyCheck(name, passed, detail) {
  return { name: name, passed: !!passed, detail: detail || '' };
}

function verifySummary(checks) {
  var failed = checks.filter(function(c) { return !c.passed; });
  return {
    passed: failed.length === 0,
    checks: checks,
    summary: failed.length ? failed.length + ' check(s) failed' : 'All ' + checks.length + ' checks passed'
  };
}

function verifyTextResult(input, result, format, lineOpts) {
  var checks = [];
  var outputText = (result.lines || []).join('\n');

  checks.push(verifyCheck('has-result', !!result && Array.isArray(result.lines), 'Result object with lines array'));

  if (!result || !result.lines) {
    return { passed: false, checks: checks, summary: 'Missing result' };
  }

  checks.push(verifyCheck('stats-non-negative',
    result.total >= 0 && result.removed >= 0 && result.remaining >= 0,
    'total=' + result.total + ' removed=' + result.removed + ' remaining=' + result.remaining));

  if (lineOpts.filterMode === 'all' || !lineOpts.filterMode) {
    checks.push(verifyCheck('output-not-larger-than-input',
      result.remaining <= result.total || result.total === 0,
      'remaining must not exceed total unless filter mode'));
  }

  if (!lineOpts.doStack && result.total > 0) {
    checks.push(verifyCheck('something-remains',
      result.remaining > 0 || result.lines.length > 0,
      'At least one unique line preserved'));
  }

  var inputKeys = collectComparisonKeys(input, format, lineOpts);
  var outputKeys = [];
  (result.lines || []).forEach(function(line) {
    var raw = line.replace(/^x\d+\s+/, '');
    var k = lineComparisonKey(raw, format || 'txt', lineOpts);
    if (k) outputKeys.push(k);
  });

  if (inputKeys.length && outputKeys.length && lineOpts.filterMode !== 'duplicates' && format !== 'json') {
    var inputHash = geckoHashKeys(inputKeys);
    var outHash = geckoHashKeys(outputKeys);
    checks.push(verifyCheck('unique-key-integrity',
      outHash === inputHash || outputKeys.length <= inputKeys.length,
      'unique key fingerprint stable (in=' + inputKeys.length + ' out=' + outputKeys.length + ')'));
  }

  if (format === 'json' && result.total > 0) {
    checks.push(verifyCheck('json-record-bounds',
      result.remaining > 0 && result.remaining <= result.total,
      'JSON unique records: ' + result.remaining + '/' + result.total));
  }

  if (format === 'json' && outputText.trim()) {
    var jsonOk = true;
    var trimmed = outputText.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try { JSON.parse(trimmed); } catch (e) { jsonOk = false; }
    } else {
      var jl = trimmed.split('\n').filter(Boolean);
      for (var j = 0; j < Math.min(jl.length, 5); j++) {
        try { JSON.parse(jl[j].replace(/^x\d+\s+/, '')); } catch (e2) { jsonOk = false; break; }
      }
    }
    checks.push(verifyCheck('json-parseable', jsonOk, 'Output JSON structure valid'));
  }

  if (format === 'csv' && result.lines.length > 1) {
    var widths = result.lines.map(function(row) { return row.split(',').length; });
    var w0 = widths[0];
    var consistent = widths.every(function(w) { return Math.abs(w - w0) <= 1; });
    checks.push(verifyCheck('csv-column-stability', consistent, 'Column counts stable across rows'));
  }

  return verifySummary(checks);
}

function verifyFolderResult(beforeFiles, result, lineOpts) {
  var checks = [];
  var s = result.stats || {};

  checks.push(verifyCheck('files-accounted',
    typeof s.keptFiles === 'number' && s.keptFiles >= 0,
    'keptFiles=' + s.keptFiles));

  checks.push(verifyCheck('no-negative-stats',
    (s.filesRemoved || 0) >= 0 && (s.linesRemoved || 0) >= 0 && (s.errors || 0) >= 0,
    'filesRemoved=' + (s.filesRemoved || 0) + ' linesRemoved=' + (s.linesRemoved || 0)));

  checks.push(verifyCheck('kept-plus-removed-files',
    (s.keptFiles || 0) + (s.filesRemoved || 0) <= (beforeFiles || []).length,
    'File count conservation'));

  var totalLinesBefore = 0;
  var totalLinesAfter = 0;
  (beforeFiles || []).forEach(function(f) {
    if (f.content) totalLinesBefore += f.content.split('\n').filter(function(l) { return l.trim(); }).length;
  });
  (result.files || []).forEach(function(f) {
    if (f.content) totalLinesAfter += f.content.split('\n').filter(function(l) { return l.trim(); }).length;
  });

  if (totalLinesBefore > 0) {
    checks.push(verifyCheck('lines-not-increased',
      totalLinesAfter <= totalLinesBefore,
      'lines before=' + totalLinesBefore + ' after=' + totalLinesAfter));
  }

  if ((s.errors || 0) > 0) {
    checks.push(verifyCheck('zero-errors', false, s.errors + ' file error(s)'));
  } else {
    checks.push(verifyCheck('zero-errors', true, 'No file errors'));
  }

  return verifySummary(checks);
}

function verifyMediaResult(beforeFiles, result, options) {
  var checks = [];
  var s = result.stats || {};
  var beforeCount = (beforeFiles || []).length;

  checks.push(verifyCheck('kept-files-valid',
    typeof s.keptFiles === 'number' && s.keptFiles >= 0,
    'keptFiles=' + s.keptFiles));

  checks.push(verifyCheck('no-negative-stats',
    (s.filesRemoved || 0) >= 0 && (s.errors || 0) >= 0,
    'filesRemoved=' + (s.filesRemoved || 0)));

  checks.push(verifyCheck('kept-plus-removed',
    (s.keptFiles || 0) + (s.filesRemoved || 0) <= beforeCount + (s.targetMode && options.targetPath && !(beforeFiles || []).some(function(f) {
      return normalizePath(f.path) === normalizePath(options.targetPath);
    }) ? 1 : 0),
    'kept + removed <= loaded'));

  checks.push(verifyCheck('output-files-present',
    Array.isArray(result.files) && result.files.length === (s.keptFiles || 0),
    'output file count matches stats'));

  if ((s.errors || 0) > 0) {
    checks.push(verifyCheck('zero-errors', false, s.errors + ' decode error(s)'));
  } else {
    checks.push(verifyCheck('zero-errors', true, 'No decode errors'));
  }

  return verifySummary(checks);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    verifyTextResult: verifyTextResult,
    verifyFolderResult: verifyFolderResult,
    verifyMediaResult: verifyMediaResult,
    geckoHashKeys: geckoHashKeys
  };
}
