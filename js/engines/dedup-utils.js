function normalizeEngineText(txt) {
  if (!txt) return '';
  return txt.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function emptyDedupResult() {
  return { lines: [], total: 0, removed: 0, remaining: 0 };
}

function normalizeRawLine(rawLine, doBlanks) {
  rawLine = rawLine.replace(/\s+$/, '').replace(/\t/g, '    ');
  if (!doBlanks) rawLine = rawLine.replace(/^\s+/, '');
  return rawLine;
}

function dedupLookupKey(comparisonLine, doCaps) {
  return doCaps ? comparisonLine.toLowerCase() : comparisonLine;
}

function createExactKeyIndex() {
  return Object.create(null);
}

function exactKeyLookup(keyIndex, key) {
  return keyIndex[key];
}

function exactKeyStore(keyIndex, key, index) {
  keyIndex[key] = index;
}

function findDuplicateIndex(uniques, key, compareKeyFn, simThreshold, keySet) {
  if (simThreshold === 1) return -1;
  var bestSim = -1;
  var bestIndex = -1;
  var keyLen = key.length;
  for (var j = 0; j < uniques.length; j++) {
    var compareKey = compareKeyFn(uniques[j]);
    if (key === compareKey) return j;
    if (keyLen > 0 && Math.abs(compareKey.length - keyLen) > keyLen * 0.6) continue;
    if (!uniques[j].wordSet) uniques[j].wordSet = getWordSet(compareKey);
    var sim = calculateSimilarityCached(key, compareKey, keySet, uniques[j].wordSet);
    if (sim > bestSim) {
      bestSim = sim;
      bestIndex = j;
    }
  }
  return bestSim >= simThreshold ? bestIndex : -1;
}

function findUniqueIndex(uniques, key, doCaps, simThreshold) {
  if (simThreshold === 1) {
    for (var j = 0; j < uniques.length; j++) {
      if (key === (doCaps ? uniques[j].key.toLowerCase() : uniques[j].key)) return j;
    }
    return -1;
  }
  return findDuplicateIndex(uniques, key, function(u) {
    return doCaps ? u.key.toLowerCase() : u.key;
  }, simThreshold, getWordSet(key));
}

function mergeUnique(uniques, foundIndex, entry, onMerge) {
  if (foundIndex !== -1) {
    uniques[foundIndex].count++;
    if (onMerge) onMerge(uniques[foundIndex], entry);
  } else {
    uniques.push(entry);
  }
}

function makeLineUniqueEntry(rawLine, comparisonLine, key) {
  return { line: rawLine, key: comparisonLine, count: 1, wordSet: getWordSet(key) };
}

function finishLineDedup(uniques, doStack, total, filterMode, sortOrder, outputField) {
  outputField = outputField || 'line';
  var removedCount = total - uniques.length;
  uniques = filterUniques(uniques, filterMode);
  sortUniques(uniques, sortOrder);
  var outputLines = [];
  for (var k = 0; k < uniques.length; k++) {
    var text = uniques[k][outputField];
    outputLines.push(doStack ? 'x' + uniques[k].count + ' ' + text : text);
  }
  return { lines: outputLines, total: total, removed: removedCount, remaining: uniques.length };
}

function buildLineOpts(opts) {
  opts = opts || {};
  return {
    doStack: opts.doStack,
    doCaps: opts.doCaps,
    doBlanks: opts.doBlanks,
    sortOrder: opts.sortOrder || 'original',
    simThreshold: opts.simThreshold != null ? opts.simThreshold : 1,
    filterMode: opts.filterMode || 'all',
    ignorePunct: opts.ignorePunct,
    collapseWs: opts.collapseWs
  };
}

function engineArgs(lineOpts) {
  var o = lineOpts;
  return [o.doStack, o.doCaps, o.doBlanks, o.sortOrder, o.simThreshold, o.filterMode, o.ignorePunct, o.collapseWs];
}
