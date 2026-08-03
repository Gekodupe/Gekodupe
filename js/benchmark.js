var BENCHMARK_SIZES = [1000, 5000, 10000, 25000];
var BENCHMARK_DUP_RATIO = 0.35;

function getBenchmarkSizes() {
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    return BENCHMARK_SIZES;
  }
  if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.getElementById) {
    return [1000, 5000, 10000];
  }
  return BENCHMARK_SIZES;
}

function buildDuplicateDataset(lineCount, dupRatio) {
  var uniqueCount = Math.max(1, Math.floor(lineCount * (1 - dupRatio)));
  var uniques = [];
  for (var i = 0; i < uniqueCount; i++) {
    uniques.push('row-' + i + ' sample data entry value ' + (i % 200));
  }
  var lines = [];
  for (var j = 0; j < lineCount; j++) {
    lines.push(uniques[Math.floor(Math.random() * uniqueCount)]);
  }
  return lines.join('\n');
}

function buildLogDataset(lineCount, dupRatio) {
  var templates = [
    '[2024-01-15 10:23:45] INFO  User login successful pid=12345 req=abc-def',
    '[2024-01-15 10:23:46] ERROR Connection timeout pid=67890 req=ghi-jkl',
    '[2024-01-15 10:23:47] WARN  Memory usage high pid=11111 req=mno-pqr',
    '[2024-01-15 10:23:48] DEBUG Cache miss for key session_token pid=22222',
    '[2024-01-15 10:23:49] INFO  Request completed in 42ms pid=33333'
  ];
  var uniqueCount = Math.max(1, Math.floor(lineCount * (1 - dupRatio)));
  var uniques = [];
  for (var i = 0; i < uniqueCount; i++) {
    uniques.push(templates[i % templates.length].replace('12345', String(10000 + i)));
  }
  var lines = [];
  for (var j = 0; j < lineCount; j++) {
    lines.push(uniques[Math.floor(Math.random() * uniqueCount)]);
  }
  return lines.join('\n');
}

function runSingleBenchmark(text, label) {
  var byteSize = new Blob([text]).size || text.length;
  var start = (typeof performance !== 'undefined' ? performance : Date).now();
  var result = processPlainLines(text, false, true, false, 'original', 1, 'txt', 'all', false, false);
  var elapsed = (typeof performance !== 'undefined' ? performance : Date).now() - start;
  var outputText = result.lines.join('\n');
  var outputBytes = new Blob([outputText]).size || outputText.length;
  var bytesSaved = byteSize - outputBytes;

  return {
    label: label,
    total: result.total,
    removed: result.removed,
    remaining: result.remaining,
    reductionPct: result.total > 0 ? Math.round((result.removed / result.total) * 1000) / 10 : 0,
    ms: Math.round(elapsed * 10) / 10,
    linesPerSec: elapsed > 0 ? Math.round(result.total / (elapsed / 1000)) : 0,
    bytesIn: byteSize,
    bytesOut: outputBytes,
    bytesSaved: bytesSaved,
    bytesSavedPct: byteSize > 0 ? Math.round((bytesSaved / byteSize) * 1000) / 10 : 0
  };
}

function runBenchmarkSuite() {
  var throughput = [];
  var sizes = getBenchmarkSizes();
  var i;
  for (i = 0; i < sizes.length; i++) {
    var size = sizes[i];
    var text = buildDuplicateDataset(size, BENCHMARK_DUP_RATIO);
    throughput.push(runSingleBenchmark(text, size.toLocaleString() + ' lines'));
  }

  var savingsDemo = runSingleBenchmark(
    buildDuplicateDataset(10000, 0.40),
    '10k mixed duplicates'
  );

  var logDemo = runSingleBenchmark(
    buildLogDataset(5000, 0.30),
    '5k log entries'
  );

  var peak = throughput.reduce(function(best, row) {
    return row.linesPerSec > best.linesPerSec ? row : best;
  }, throughput[0]);

  var avgReduction = throughput.reduce(function(sum, row) {
    return sum + row.reductionPct;
  }, 0) / throughput.length;

  var largest = throughput.reduce(function(best, row) {
    return row.total > best.total ? row : best;
  }, throughput[0]);

  var out = {
    ranAt: new Date().toISOString(),
    throughput: throughput,
    savingsDemo: savingsDemo,
    logDemo: logDemo,
    summary: {
      avgReductionPct: Math.round(avgReduction * 10) / 10,
      peakLinesPerSec: peak.linesPerSec,
      peakAt: peak.label,
      largestBatchMs: largest.ms,
      largestBatchLines: largest.total,
      logReductionPct: Math.round(logDemo.reductionPct),
      savingsDupRatioPct: 40,
      totalFormats: 7,
      privacyNote: '100% browser-local'
    }
  };

  if (typeof processFolderProject === 'function') {
    out.folderThroughput = runFolderBenchmarkSuite();
    out.folderDemo = out.folderThroughput[out.folderThroughput.length - 1];
    var folderPeak = out.folderThroughput.reduce(function(best, row) {
      return row.filesPerSec > best.filesPerSec ? row : best;
    }, out.folderThroughput[0]);
    out.summary.folderPeakFilesPerSec = folderPeak.filesPerSec;
    out.summary.folderPeakAt = folderPeak.label;
  }

  return out;
}

var FOLDER_BENCHMARK_SIZES = [10, 25, 50];

function buildFolderBenchmarkFiles(fileCount) {
  var files = [];
  var i;
  for (i = 0; i < fileCount; i++) {
    var dup = i % 7 === 0;
    var content = 'id,name,value\n' + i + ',item' + i + ',' + (dup ? 42 : i) +
      '\n' + (dup ? '2,dup,42' : '3,uniq,' + i);
    files.push({ path: 'data/file' + i + '.csv', content: content });
  }
  if (fileCount >= 10) {
    files.push({ path: 'data/dup-copy.csv', content: files[0].content });
  }
  return files;
}

function getDefaultFolderBenchmarkScope() {
  return {
    dedupFiles: true,
    dedupWithinFiles: true,
    dedupWithinCode: false,
    crossFileLines: true,
    detectCodeBlocks: false,
    removeCodeBlocks: false,
    preserveEntryPoints: true,
    ignoreNodeModules: true,
    ignoreGit: true,
    ignoreDist: true,
    ignoreVendor: true,
    canonicalStrategy: 'shortest',
    reportOnly: false
  };
}

function getDefaultFolderBenchmarkLineOpts() {
  return {
    doStack: true,
    doCaps: false,
    doBlanks: true,
    sortOrder: 'original',
    simThreshold: 1,
    filterMode: 'all',
    ignorePunct: false,
    collapseWs: false
  };
}

function runFolderBenchmark(fileCount, scopeOpts, lineOpts) {
  var files = buildFolderBenchmarkFiles(fileCount);
  var start = (typeof performance !== 'undefined' ? performance : Date).now();
  var result = processFolderProject(files, scopeOpts, lineOpts);
  var elapsed = Math.max(0.1, (typeof performance !== 'undefined' ? performance : Date).now() - start);
  var ms = Math.max(1, Math.round(elapsed));
  return {
    label: fileCount + ' files',
    total: fileCount,
    ms: ms,
    filesRemoved: result.stats.filesRemoved,
    linesRemoved: result.stats.linesRemoved,
    filesPerSec: Math.round(fileCount / (elapsed / 1000))
  };
}

function runFolderBenchmarkSuite(scopeOpts, lineOpts) {
  scopeOpts = scopeOpts || getDefaultFolderBenchmarkScope();
  lineOpts = lineOpts || getDefaultFolderBenchmarkLineOpts();
  var rows = [];
  var i;
  for (i = 0; i < FOLDER_BENCHMARK_SIZES.length; i++) {
    rows.push(runFolderBenchmark(FOLDER_BENCHMARK_SIZES[i], scopeOpts, lineOpts));
  }
  return rows;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BENCHMARK_SIZES: BENCHMARK_SIZES,
    FOLDER_BENCHMARK_SIZES: FOLDER_BENCHMARK_SIZES,
    getBenchmarkSizes: getBenchmarkSizes,
    buildDuplicateDataset: buildDuplicateDataset,
    buildLogDataset: buildLogDataset,
    buildFolderBenchmarkFiles: buildFolderBenchmarkFiles,
    runSingleBenchmark: runSingleBenchmark,
    runFolderBenchmark: runFolderBenchmark,
    runFolderBenchmarkSuite: runFolderBenchmarkSuite,
    runBenchmarkSuite: runBenchmarkSuite
  };
}
