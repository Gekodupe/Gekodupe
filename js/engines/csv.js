function processCsv(txt, doStack, doCaps, doBlanks, sortOrder, simThreshold, filterMode, ignorePunct, collapseWs) {
  try {
    if (typeof Papa === 'undefined') {
      return processPlainLines(txt, doStack, doCaps, doBlanks, sortOrder, simThreshold, 'csv', filterMode, ignorePunct, collapseWs);
    }

    var keepHeader = isEngineChecked('csv-header', true);
    var parsed = Papa.parse(txt, { header: false, skipEmptyLines: false });
    var rows = parsed.data;
    if (!rows || rows.length === 0) return emptyDedupResult();

    var headerRow = null;
    var dataRows = rows;
    var total = rows.length;

    if (keepHeader && rows.length > 0) {
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].join('').trim() !== '') {
          headerRow = rows[i];
          dataRows = rows.slice(i + 1);
          break;
        }
      }
    }

    var uniques = [];
    for (var r = 0; r < dataRows.length; r++) {
      var rawLine = Papa.unparse([dataRows[r]]);
      if (rawLine.trim() === '') continue;

      var comparisonLine = applyGlobalComparisonFilters(rawLine, ignorePunct, collapseWs);
      var key = dedupLookupKey(comparisonLine, doCaps);
      mergeUnique(uniques, findUniqueIndex(uniques, key, doCaps, simThreshold), makeLineUniqueEntry(rawLine, comparisonLine, key));
    }

    var result = finishLineDedup(uniques, doStack, total, filterMode, sortOrder);
    if (headerRow) {
      result.lines.unshift(Papa.unparse([headerRow]));
      result.remaining += 1;
    }
    result.removed = total - result.remaining;
    return result;
  } catch (e) {
    console.error('CSV parse error:', e);
    safeToast('CSV parse error: ' + e.message + '. Using plain text.', 'warning');
    return processPlainLines(txt, doStack, doCaps, doBlanks, sortOrder, simThreshold, 'csv', filterMode, ignorePunct, collapseWs);
  }
}
