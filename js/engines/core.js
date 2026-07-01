function getWordSet(str) {
  var words = str.toLowerCase().match(/\w+/g) || [];
  return new Set(words);
}

function calculateSimilarityCached(str1, str2, set1, set2) {
  if (str1 === str2) return 1;
  if (!set1) set1 = getWordSet(str1);
  if (!set2) set2 = getWordSet(str2);
  if (set1.size === 0 || set2.size === 0) return 0;

  var intersection = 0;
  set1.forEach(function(word) {
    if (set2.has(word)) intersection++;
  });

  var union = set1.size + set2.size - intersection;
  return intersection / union;
}

function calculateSimilarity(str1, str2) {
  return calculateSimilarityCached(str1, str2, null, null);
}

function stripMarkdownBullets(line) {
  return line.replace(/^\s*(?:[\*\-\+]|\d+\.)\s+/, '').trim();
}

function applyGlobalComparisonFilters(line, ignorePunct, collapseWs) {
  var s = line;
  if (ignorePunct) {
    s = s.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'\[\]]/g, '');
  }
  if (collapseWs) {
    s = s.replace(/\s+/g, ' ').trim();
  }
  return s;
}

function uniqueSortKey(u) {
  var val = u.line !== undefined ? u.line : (u.key !== undefined ? u.key : '');
  return val.toString().toUpperCase();
}

function sortUniques(uniques, sortOrder) {
  if (!sortOrder || sortOrder === 'original' || sortOrder === false) return;
  if (sortOrder === true || sortOrder === 'alpha-asc') {
    uniques.sort(function(a, b) {
      var x = uniqueSortKey(a);
      var y = uniqueSortKey(b);
      return x > y ? 1 : x < y ? -1 : 0;
    });
  } else if (sortOrder === 'alpha-desc') {
    uniques.sort(function(a, b) {
      var x = uniqueSortKey(a);
      var y = uniqueSortKey(b);
      return x < y ? 1 : x > y ? -1 : 0;
    });
  } else if (sortOrder === 'freq-desc') {
    uniques.sort(function(a, b) {
      return b.count - a.count;
    });
  }
}

function filterUniques(uniques, filterMode) {
  if (!filterMode || filterMode === 'all') return uniques;
  if (filterMode === 'duplicates') {
    return uniques.filter(function(u) { return u.count > 1; });
  }
  if (filterMode === 'singletons') {
    return uniques.filter(function(u) { return u.count === 1; });
  }
  return uniques;
}

function processPlainLines(txt, doStack, doCaps, doBlanks, sortOrder, simThreshold, currentFormatMode, filterMode, ignorePunct, collapseWs) {
  if (!txt || !txt.trim()) return emptyDedupResult();

  txt = normalizeEngineText(txt);
  var lines = txt.split('\n');
  var total = 0;
  var uniques = [];
  var keyIndex = createExactKeyIndex();
  var useExactIndex = simThreshold === 1;

  for (var i = 0; i < lines.length; i++) {
    var rawLine = normalizeRawLine(lines[i], doBlanks);
    if (rawLine === '') continue;
    total++;

    var comparisonLine = rawLine;
    if (currentFormatMode === 'txt' && isEngineChecked('md-bullets', false)) {
      comparisonLine = stripMarkdownBullets(comparisonLine);
    }

    comparisonLine = applyGlobalComparisonFilters(comparisonLine, ignorePunct, collapseWs);
    var key = dedupLookupKey(comparisonLine, doCaps);
    var foundIndex = -1;

    if (useExactIndex) {
      foundIndex = exactKeyLookup(keyIndex, key);
      if (foundIndex === undefined) foundIndex = -1;
    } else {
      foundIndex = findDuplicateIndex(uniques, key, function(u) {
        return doCaps ? u.key.toLowerCase() : u.key;
      }, simThreshold, getWordSet(key));
    }

    if (foundIndex !== -1) {
      uniques[foundIndex].count++;
    } else {
      var newIndex = uniques.length;
      uniques.push(makeLineUniqueEntry(rawLine, comparisonLine, key));
      if (useExactIndex) exactKeyStore(keyIndex, key, newIndex);
    }
  }

  return finishLineDedup(uniques, doStack, total, filterMode, sortOrder);
}
