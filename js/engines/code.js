function stripCodeComments(line, profile) {
  var p = profile || getLanguageProfile('', '');
  if (p) return stripCodeCommentsWithProfile(line, p);
  return line
    .replace(/\s*\/\/.*$/, '')
    .replace(/\s*#.*$/, '')
    .replace(/\s*--.*$/, '')
    .replace(/\s*rem\s+.*/i, '')
    .trim();
}

function stripCodeMetadata(line) {
  var s = line;
  if (isEngineChecked('code-strings', false)) {
    s = s.replace(/["'`].*?["'`]/g, '""');
  }
  if (isEngineChecked('code-numbers', false)) {
    s = s.replace(/\b0x[0-9a-fA-F]+\b/g, '0');
    s = s.replace(/\b\d+(?:\.\d+)?\b/g, '0');
  }
  return s;
}

function processCode(txt, doStack, doCaps, doBlanks, sortOrder, simThreshold, filterMode, ignorePunct, collapseWs, pathHint) {
  if (!txt || !txt.trim()) return emptyDedupResult();

  var langProfile = getLanguageProfile(pathHint || '', txt);
  var langId = getLanguageId(pathHint || '', txt);

  if (isEngineChecked('code-docstrings', true)) {
    txt = txt.replace(/\/\*[\s\S]*?\*\//g, '');
    txt = txt.replace(/"""[\s\S]*?"""/g, '');
    txt = txt.replace(/'''[\s\S]*?'''/g, '');
    txt = txt.replace(/<!--[\s\S]*?-->/g, '');
    if (langId === 'powershell') txt = txt.replace(/<#[\s\S]*?#>/g, '');
    if (langId === 'lua') txt = txt.replace(/--\[\[[\s\S]*?\]\]/g, '');
  }

  var lines = txt.split('\n');
  var total = lines.length;
  var uniques = [];
  var ignoreComments = isEngineChecked('code-comments', true);
  var ignoreIndent = isEngineChecked('code-indent', true);
  var ignoreTrailing = isEngineChecked('code-trailing', true);
  var sortImports = isEngineChecked('code-sort-imports', false);

  for (var i = 0; i < total; i++) {
    var rawLine = normalizeRawLine(lines[i], doBlanks);
    if (rawLine === '') continue;

    var comparisonLine = rawLine;
    if (ignoreComments) comparisonLine = stripCodeComments(comparisonLine, langProfile);
    comparisonLine = stripCodeMetadata(comparisonLine);
    if (ignoreIndent) comparisonLine = comparisonLine.replace(/^\s+/, '');
    if (ignoreTrailing) comparisonLine = comparisonLine.replace(/[;,]\s*$/, '');
    comparisonLine = applyGlobalComparisonFilters(comparisonLine, ignorePunct, collapseWs);

    var key = dedupLookupKey(comparisonLine, doCaps);
    mergeUnique(uniques, findUniqueIndex(uniques, key, doCaps, simThreshold), makeLineUniqueEntry(rawLine, comparisonLine, key));
  }

  uniques = filterUniques(uniques, filterMode);

  if (sortImports) {
    var importUniques = [];
    var otherUniques = [];
    for (var u = 0; u < uniques.length; u++) {
      if (uniques[u].line.match(/^\s*(?:import|from|const\s+.*?=\s*require|var\s+.*?=\s*require|let\s+.*?=\s*require|#include|using|require|use\s+|extern\s+crate|package)\b/i)) {
        importUniques.push(uniques[u]);
      } else {
        otherUniques.push(uniques[u]);
      }
    }
    importUniques.sort(function(a, b) {
      return (a.line || '').toUpperCase() > (b.line || '').toUpperCase() ? 1 : -1;
    });
    sortUniques(otherUniques, sortOrder);
    uniques = importUniques.concat(otherUniques);
  } else {
    sortUniques(uniques, sortOrder);
  }

  return finishLineDedup(uniques, doStack, total, 'all', false);
}
