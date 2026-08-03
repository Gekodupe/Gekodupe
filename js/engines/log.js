function stripLogMetadata(line) {
  var s = line;
  if (isEngineChecked('log-strip-dates', true)) {
    s = s.replace(/\[\d{4}-\d{2}-\d{2}[^\]]*\]/g, '');
    s = s.replace(/\[\d{2}:\d{2}:\d{2}[^\]]*\]/g, '');
    s = s.replace(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?\b/g, '');
    s = s.replace(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\b/g, '');
  }
  if (isEngineChecked('log-strip-uuids', true)) {
    // UUIDs before PIDs so "req id <uuid>" is not mangled
    s = s.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '');
  }
  if (isEngineChecked('log-strip-pids', true)) {
    s = s.replace(/\b(?:PID|tid|thread|req|trace|tx|trans)[=:#]?\s*\[?\d+\]?/gi, '');
    s = s.replace(/\bid[=:]\s*\[?\d+\]?/gi, '');
  }
  if (isEngineChecked('log-strip-sql', true)) {
    s = s.replace(/(\bVALUES\s*\()\s*\d+\s*,\s*/gi, '$1');
  }
  if (isEngineChecked('log-strip-ips', true)) {
    s = s.replace(/\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g, '');
    s = s.replace(/\b(?:[0-9A-Fa-f]{2}[:-]){5}(?:[0-9A-Fa-f]{2})\b/g, '');
  }
  if (isEngineChecked('log-strip-hex', true)) {
    s = s.replace(/\b0x[0-9a-fA-F]+\b/g, '');
  }
  if (isEngineChecked('log-strip-levels', true)) {
    s = s.replace(/\[?(?:INFO|WARN|WARNING|DEBUG|ERROR|TRACE|FATAL|CRITICAL)\]?[:\-]?\s*/gi, '');
  }
  if (isEngineChecked('log-strip-urls', true)) {
    s = s.replace(/\?[a-zA-Z0-9_=&%\.\-\+]+/g, '');
  }
  return s.replace(/\s{2,}/g, ' ').trim();
}

function processLog(txt, doStack, doCaps, doBlanks, sortOrder, simThreshold, filterMode, ignorePunct, collapseWs) {
  if (!txt || !txt.trim()) return emptyDedupResult();

  var lines = txt.split('\n');
  var total = lines.length;
  var uniques = [];

  for (var i = 0; i < total; i++) {
    var rawLine = normalizeRawLine(lines[i], doBlanks);
    if (rawLine === '') continue;

    var comparisonLine = applyGlobalComparisonFilters(stripLogMetadata(rawLine), ignorePunct, collapseWs);
    var key = dedupLookupKey(comparisonLine, doCaps);
    mergeUnique(uniques, findUniqueIndex(uniques, key, doCaps, simThreshold), makeLineUniqueEntry(rawLine, comparisonLine, key));
  }

  return finishLineDedup(uniques, doStack, total, filterMode, sortOrder);
}
