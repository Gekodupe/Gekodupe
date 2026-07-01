function canonicalizeJson(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalizeJson).join(',') + ']';
  }
  var keys = Object.keys(obj).sort();
  var pairs = [];
  for (var i = 0; i < keys.length; i++) {
    pairs.push(JSON.stringify(keys[i]) + ':' + canonicalizeJson(obj[keys[i]]));
  }
  return '{' + pairs.join(',') + '}';
}

function parseJsonItems(txt) {
  var items = [];
  var isArrayFormat = false;
  var total = 0;
  var trimmed = txt.trim();

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      var parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        items = parsed;
        isArrayFormat = true;
        total = items.length;
      }
    } catch (e) {}
  }

  if (!isArrayFormat) {
    var lines = txt.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      try {
        items.push(JSON.parse(line));
      } catch (e) {
        items.push(line);
      }
    }
    total = items.length;
  }

  return { items: items, isArrayFormat: isArrayFormat, total: total };
}

function processJson(txt, doStack, doCaps, doBlanks, sortOrder, simThreshold, filterMode, ignorePunct, collapseWs) {
  try {
    var isCanonical = isEngineChecked('json-canonical', true);
    var isPretty = isEngineChecked('json-pretty', true);
    var parsed = parseJsonItems(txt);
    var items = parsed.items;
    var isArrayFormat = parsed.isArrayFormat;
    var total = parsed.total;

    if (items.length === 0) return emptyDedupResult();

    var uniques = [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var itemStr = typeof item === 'string' ? item : (isCanonical ? canonicalizeJson(item) : JSON.stringify(item));
      var comparisonStr = applyGlobalComparisonFilters(itemStr, ignorePunct, collapseWs);
      var key = dedupLookupKey(comparisonStr, doCaps);
      var entry = { item: item, key: comparisonStr, count: 1, wordSet: getWordSet(key) };
      mergeUnique(uniques, findUniqueIndex(uniques, key, doCaps, simThreshold), entry);
    }

    var removedCount = total - uniques.length;
    uniques = filterUniques(uniques, filterMode);
    sortUniques(uniques, sortOrder);

    var outputLines = [];
    if (isArrayFormat && doStack) {
      for (var k = 0; k < uniques.length; k++) {
        var stacked = typeof uniques[k].item === 'string' ? uniques[k].item : JSON.stringify(uniques[k].item);
        outputLines.push('x' + uniques[k].count + ' ' + stacked);
      }
    } else if (isArrayFormat && !doStack) {
      var outArray = uniques.map(function(u) { return u.item; });
      var outStr = isPretty ? JSON.stringify(outArray, null, 2) : JSON.stringify(outArray);
      outputLines = outStr.split('\n');
    } else {
      for (var k = 0; k < uniques.length; k++) {
        var str = typeof uniques[k].item === 'string' ? uniques[k].item : JSON.stringify(uniques[k].item);
        if (doStack) str = 'x' + uniques[k].count + ' ' + str;
        outputLines.push(str);
      }
    }

    return { lines: outputLines, total: total, removed: removedCount, remaining: uniques.length };
  } catch (e) {
    console.error('JSON error:', e);
    safeToast('JSON error: ' + e.message + '. Using plain text.', 'warning');
    return processPlainLines(txt, doStack, doCaps, doBlanks, sortOrder, simThreshold, 'json', filterMode, ignorePunct, collapseWs);
  }
}
