function stripTodoState(line) {
  var s = line;
  if (isEngineChecked('todo-state', true)) {
    s = s.replace(/^\s*(?:[\*\-\+]|\d+\.)?\s*\[[ xX_/]\]\s*/, '');
  }
  if (isEngineChecked('todo-prefixes', true)) {
    s = s.replace(/^\s*(?:TODO|DONE|WAITING|COMPLETED|CANCELLED|PENDING):\s*/i, '');
  }
  return s.trim();
}

function processTodo(txt, doStack, doCaps, doBlanks, sortOrder, simThreshold, filterMode, ignorePunct, collapseWs) {
  if (!txt || !txt.trim()) return emptyDedupResult();

  var lines = txt.split('\n');
  var total = lines.length;
  var uniques = [];

  for (var i = 0; i < total; i++) {
    var rawLine = normalizeRawLine(lines[i], doBlanks);
    if (rawLine === '') continue;

    var comparisonLine = applyGlobalComparisonFilters(stripTodoState(rawLine), ignorePunct, collapseWs);
    var key = dedupLookupKey(comparisonLine, doCaps);
    mergeUnique(uniques, findUniqueIndex(uniques, key, doCaps, simThreshold), makeLineUniqueEntry(rawLine, comparisonLine, key), function(existing, entry) {
      if (entry.line.match(/\[[xX]\]/) || entry.line.match(/DONE:/i)) {
        existing.line = entry.line;
      }
    });
  }

  return finishLineDedup(uniques, doStack, total, filterMode, sortOrder);
}
