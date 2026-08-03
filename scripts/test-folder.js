var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.join(__dirname, '..');
var ctx = {
  window: {},
  document: { getElementById: function() { return null; } },
  module: { exports: {} },
  exports: {},
  console: console,
  Math: Math,
  Set: Set,
  Promise: Promise,
  XLSX: null
};

['options', 'intelligence', 'checkpoint', 'verify', 'dedup-utils', 'core', 'csv', 'json', 'log', 'code', 'todo', 'excel', 'folder', 'pipeline'].forEach(function(f) {
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js', 'engines', f + '.js'), 'utf8'), ctx);
});

var files = [
  { path: 'data/items.txt', content: 'apple\nbanana\napple\ncherry' },
  { path: 'data/copy.txt', content: 'apple\nbanana\norange' },
  { path: 'src/utils.js', content: 'function helper() {\n  return 1;\n}\n' },
  { path: 'lib/utils.js', content: 'function helper() {\n  return 1;\n}\n' },
  { path: 'src/index.js', content: 'function helper() {\n  return 1;\n}\n' }
];

var scope = {
  dedupFiles: true,
  dedupWithinFiles: true,
  dedupWithinCode: false,
  crossFileLines: true,
  detectCodeBlocks: true,
  removeCodeBlocks: false,
  preserveEntryPoints: true,
  ignoreNodeModules: true,
  ignoreGit: true,
  ignoreDist: true,
  ignoreVendor: true,
  canonicalStrategy: 'shortest',
  reportOnly: false
};

var lineOpts = {
  doStack: false, doCaps: false, doBlanks: false, sortOrder: 'original',
  filterMode: 'all', ignorePunct: false, collapseWs: false, simThreshold: 1
};

var result = ctx.processFolderProject(files, scope, lineOpts);
console.log('Kept:', result.stats.keptFiles, 'Modified:', result.stats.filesModified, 'Lines removed:', result.stats.linesRemoved);
result.report.forEach(function(r) { console.log(' ', r); });
if (result.stats.keptFiles < 1 || result.stats.linesRemoved < 1) process.exit(1);
console.log('OK');
