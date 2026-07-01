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
  Promise: Promise
};

['options', 'intelligence', 'checkpoint', 'verify', 'dedup-utils', 'core', 'folder', 'media', 'pipeline'].forEach(function(f) {
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js', 'engines', f + '.js'), 'utf8'), ctx);
});

function bitsToHex(bits) {
  var hex = '';
  for (var i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

var hash = bitsToHex('1111000011110000111100001111000011110000111100001111000011110000');
var other = bitsToHex('0000111100001111000011110000111100001111000011110000111100001111');

var analyzed = [
  {
    path: 'roll/IMG_001.jpg',
    binaryData: new ArrayBuffer(8),
    sig: {
      kind: 'image',
      dHash: hash,
      aHash: hash,
      blockHash: hash,
      scales: [hash],
      exactHash: 'a',
      width: 4000,
      height: 3000,
      byteSize: 1000
    }
  },
  {
    path: 'roll/IMG_002.jpg',
    binaryData: new ArrayBuffer(8),
    sig: {
      kind: 'image',
      dHash: hash,
      aHash: hash,
      blockHash: hash,
      scales: [hash],
      exactHash: 'b',
      width: 4000,
      height: 3000,
      byteSize: 1000
    }
  },
  {
    path: 'unique/shot.jpg',
    binaryData: new ArrayBuffer(8),
    sig: {
      kind: 'image',
      dHash: other,
      aHash: other,
      blockHash: other,
      scales: [other],
      exactHash: 'c',
      width: 1920,
      height: 1080,
      byteSize: 1000
    }
  }
];

var passthrough = [
  { path: 'final/approved.jpg', binaryData: new ArrayBuffer(8), passthrough: true, skip: true }
];

var result = ctx.processMediaAnalysisResults(passthrough, analyzed, {
  similarity: 92,
  collapseBursts: true,
  maxBurstKeep: 1,
  keepLargest: true,
  allowResize: true
});

console.log('Removed:', result.stats.filesRemoved, 'Kept:', result.stats.keptFiles, 'Passthrough:', result.stats.passthroughFiles);
result.report.slice(0, 6).forEach(function(r) { console.log(' ', r); });

var verify = ctx.verifyMediaResult(
  analyzed.concat(passthrough).map(function(f) { return { path: f.path, binaryData: f.binaryData }; }),
  result,
  { similarity: 92 }
);
console.log('Verify:', verify.summary);

if (result.stats.filesRemoved < 1) process.exit(1);
if (result.stats.keptFiles < 2) process.exit(1);
if (!result.files.some(function(f) { return f.path === 'final/approved.jpg'; })) process.exit(1);
if (!verify.passed) process.exit(1);

var targetAnalyzed = [
  {
    path: 'roll/IMG_001.jpg',
    binaryData: new ArrayBuffer(8),
    sig: analyzed[0].sig
  },
  {
    path: 'roll/IMG_002.jpg',
    binaryData: new ArrayBuffer(8),
    sig: analyzed[1].sig
  },
  {
    path: 'unique/shot.jpg',
    binaryData: new ArrayBuffer(8),
    sig: analyzed[2].sig
  }
];

var targetResult = ctx.processMediaAnalysisResults([], targetAnalyzed, {
  similarity: 92,
  useTargetReference: true,
  targetPath: 'roll/IMG_001.jpg',
  targetSig: targetAnalyzed[0].sig,
  targetBinary: targetAnalyzed[0].binaryData,
  allowResize: true
});

console.log('Target mode removed:', targetResult.stats.filesRemoved, 'Kept:', targetResult.stats.keptFiles);
if (targetResult.stats.filesRemoved !== 1) process.exit(1);
if (!targetResult.files.some(function(f) { return f.path === 'unique/shot.jpg'; })) process.exit(1);
if (!targetResult.files.some(function(f) { return f.path === 'roll/IMG_001.jpg'; })) process.exit(1);
if (targetResult.files.some(function(f) { return f.path === 'roll/IMG_002.jpg'; })) process.exit(1);

var targetVerify = ctx.verifyMediaResult(
  targetAnalyzed.map(function(f) { return { path: f.path, binaryData: f.binaryData }; }),
  targetResult,
  { similarity: 92, useTargetReference: true, targetPath: 'roll/IMG_001.jpg' }
);
if (!targetVerify.passed) process.exit(1);

console.log('OK');
