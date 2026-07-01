// Shared line comparison key used by verify, folder, and text engines.

function lineComparisonKey(line, format, lineOpts) {
  var s = normalizeRawLine(line, lineOpts.doBlanks);
  if (format === 'log') {
    s = stripLogMetadata(s);
  } else if (format === 'todo') {
    s = stripTodoState(s);
  } else if (format === 'code') {
    s = stripCodeComments(s, getLanguageProfile('', s));
    if (isEngineChecked('code-indent', true)) s = s.replace(/^\s+/, '');
    if (isEngineChecked('code-trailing', true)) s = s.replace(/[;,]\s*$/, '');
  } else if (format === 'txt' && isEngineChecked('md-bullets', false)) {
    s = stripMarkdownBullets(s);
  } else if (format === 'json') {
    var trimmed = s.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        var parsed = JSON.parse(trimmed);
        s = isEngineChecked('json-canonical', true) ? canonicalizeJson(parsed) : JSON.stringify(parsed);
      } catch (e) { /* keep raw */ }
    }
  }
  s = applyGlobalComparisonFilters(s, lineOpts.ignorePunct, lineOpts.collapseWs);
  if (lineOpts.doCaps) s = s.toLowerCase();
  return s;
}
