var MEDIA_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.avif', '.tif', '.tiff', '.heic', '.heif'];
var MEDIA_VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.m4v', '.avi', '.mkv', '.mpeg', '.mpg', '.3gp', '.wmv'];
var MEDIA_MIME_BY_EXT = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
  '.webp': 'image/webp', '.bmp': 'image/bmp', '.avif': 'image/avif', '.tif': 'image/tiff', '.tiff': 'image/tiff',
  '.heic': 'image/heic', '.heif': 'image/heif',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.m4v': 'video/mp4',
  '.avi': 'video/x-msvideo', '.mkv': 'video/x-matroska', '.mpeg': 'video/mpeg', '.mpg': 'video/mpeg',
  '.3gp': 'video/3gpp', '.wmv': 'video/x-ms-wmv'
};

var MEDIA_HASH_BITS = 64;
var MEDIA_BANDS = 4;

function mediaExt(path) {
  var lower = (path || '').toLowerCase();
  var dot = lower.lastIndexOf('.');
  return dot === -1 ? '' : lower.slice(dot);
}

function isMediaImagePath(path) { return MEDIA_IMAGE_EXTS.indexOf(mediaExt(path)) !== -1; }
function isMediaVideoPath(path) { return MEDIA_VIDEO_EXTS.indexOf(mediaExt(path)) !== -1; }
function isMediaPath(path) { return isMediaImagePath(path) || isMediaVideoPath(path); }

function mimeFromMediaPath(path) {
  return MEDIA_MIME_BY_EXT[mediaExt(path)] || 'application/octet-stream';
}

function bitsToHex(bits) {
  var hex = '';
  for (var i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

function hexToBits(hex) {
  var bits = '';
  for (var i = 0; i < hex.length; i++) {
    bits += parseInt(hex.charAt(i), 16).toString(2).padStart(4, '0');
  }
  return bits;
}

function padHashHex(hex) {
  var bits = hexToBits(hex || '');
  if (bits.length < MEDIA_HASH_BITS) bits = bits.padEnd(MEDIA_HASH_BITS, '0');
  if (bits.length > MEDIA_HASH_BITS) bits = bits.slice(0, MEDIA_HASH_BITS);
  return bitsToHex(bits);
}

function hammingDistanceHex(a, b) {
  if (!a || !b) return MEDIA_HASH_BITS;
  var bitsA = hexToBits(padHashHex(a));
  var bitsB = hexToBits(padHashHex(b));
  var dist = 0;
  for (var i = 0; i < MEDIA_HASH_BITS; i++) {
    if (bitsA.charAt(i) !== bitsB.charAt(i)) dist++;
  }
  return dist;
}

function minHammingAcross(hashListsA, hashListsB) {
  var best = MEDIA_HASH_BITS;
  for (var a = 0; a < hashListsA.length; a++) {
    for (var b = 0; b < hashListsB.length; b++) {
      var d = hammingDistanceHex(hashListsA[a], hashListsB[b]);
      if (d < best) best = d;
    }
  }
  return best;
}

function similarityPercentFromHamming(dist, bits) {
  bits = bits || MEDIA_HASH_BITS;
  return Math.round((1 - dist / bits) * 1000) / 10;
}

function maxHammingFromSimilarity(simPercent) {
  var p = Math.max(75, Math.min(100, Number(simPercent) || 100));
  if (p >= 100) return 0;
  return Math.max(1, Math.floor((100 - p) / 100 * MEDIA_HASH_BITS));
}

function minSimilarityScoreFromSlider(simPercent) {
  var maxDist = maxHammingFromSimilarity(simPercent);
  if (maxDist <= 0) return 1;
  return 1 - maxDist / MEDIA_HASH_BITS;
}

function grayscaleFromImageData(data, width, height) {
  var gray = new Float32Array(width * height);
  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      var i = (y * width + x) * 4;
      gray[y * width + x] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
  }
  return gray;
}

function dHashFromGrayscale(gray, width, height) {
  var bits = '';
  for (var y = 0; y < height - 1; y++) {
    for (var x = 0; x < width - 1; x++) {
      bits += gray[y * width + x] < gray[y * width + x + 1] ? '1' : '0';
    }
  }
  while (bits.length < MEDIA_HASH_BITS) bits += '0';
  return bitsToHex(bits.slice(0, MEDIA_HASH_BITS));
}

function aHashFromGrayscale(gray) {
  var sum = 0;
  for (var i = 0; i < gray.length; i++) sum += gray[i];
  var avg = sum / gray.length;
  var bits = '';
  for (var j = 0; j < gray.length; j++) bits += gray[j] >= avg ? '1' : '0';
  while (bits.length < MEDIA_HASH_BITS) bits += '0';
  return bitsToHex(bits.slice(0, MEDIA_HASH_BITS));
}

function computeHashesFromGray(gray, width, height) {
  return {
    dHash: dHashFromGrayscale(gray, width, height),
    aHash: aHashFromGrayscale(gray)
  };
}

function subsampleGray(gray, width, height, targetW, targetH) {
  var out = new Float32Array(targetW * targetH);
  for (var y = 0; y < targetH; y++) {
    for (var x = 0; x < targetW; x++) {
      var sx = Math.min(width - 1, Math.floor(x * width / targetW));
      var sy = Math.min(height - 1, Math.floor(y * height / targetH));
      out[y * targetW + x] = gray[sy * width + sx];
    }
  }
  return { gray: out, width: targetW, height: targetH };
}

function colorLayoutHashFromGray(gray, width, height) {
  var grid = 8;
  var cellW = width / grid;
  var cellH = height / grid;
  var lum = [];
  for (var gy = 0; gy < grid; gy++) {
    for (var gx = 0; gx < grid; gx++) {
      var sum = 0;
      var count = 0;
      var x0 = Math.floor(gx * cellW);
      var y0 = Math.floor(gy * cellH);
      var x1 = Math.min(width, Math.floor((gx + 1) * cellW));
      var y1 = Math.min(height, Math.floor((gy + 1) * cellH));
      for (var y = y0; y < y1; y++) {
        for (var x = x0; x < x1; x++) {
          sum += gray[y * width + x];
          count++;
        }
      }
      lum.push(count ? sum / count : 0);
    }
  }
  var avg = lum.reduce(function(a, b) { return a + b; }, 0) / lum.length;
  var bits = '';
  for (var k = 0; k < lum.length; k++) bits += lum[k] >= avg ? '1' : '0';
  while (bits.length < MEDIA_HASH_BITS) bits += '0';
  return bitsToHex(bits.slice(0, MEDIA_HASH_BITS));
}

function colorLayoutHashFromImageData(data, width, height) {
  return colorLayoutHashFromGray(grayscaleFromImageData(data, width, height), width, height);
}

var VIDEO_HUE_BINS = 12;

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  var max = Math.max(r, g, b);
  var min = Math.min(r, g, b);
  var d = max - min;
  var h = 0;
  var s = max === 0 ? 0 : d / max;
  var v = max;
  if (d > 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h, s: s, v: v };
}

function computeHueHistogram(data, width, height, bins) {
  bins = bins || VIDEO_HUE_BINS;
  var hist = new Float64Array(bins);
  var total = 0;
  var step = Math.max(1, Math.floor(Math.sqrt(width * height) / 72));
  for (var y = 0; y < height; y += step) {
    for (var x = 0; x < width; x += step) {
      var i = (y * width + x) * 4;
      var hsv = rgbToHsv(data[i], data[i + 1], data[i + 2]);
      if (hsv.s < 0.08) continue;
      var bin = Math.min(bins - 1, Math.floor(hsv.h * bins));
      hist[bin] += hsv.s;
      total += hsv.s;
    }
  }
  if (total > 0) {
    for (var j = 0; j < bins; j++) hist[j] /= total;
  }
  return Array.from(hist);
}

function computeFrameStats(data, width, height) {
  var sumL = 0;
  var sumL2 = 0;
  var sumS = 0;
  var count = 0;
  var step = Math.max(1, Math.floor(Math.sqrt(width * height) / 72));
  for (var y = 0; y < height; y += step) {
    for (var x = 0; x < width; x += step) {
      var i = (y * width + x) * 4;
      var hsv = rgbToHsv(data[i], data[i + 1], data[i + 2]);
      sumL += hsv.v;
      sumL2 += hsv.v * hsv.v;
      sumS += hsv.s;
      count++;
    }
  }
  if (!count) return { luma: 0, contrast: 0, saturation: 0 };
  var mean = sumL / count;
  var variance = Math.max(0, sumL2 / count - mean * mean);
  return { luma: mean, contrast: Math.sqrt(variance), saturation: sumS / count };
}

function bhattacharyyaCoeff(hA, hB) {
  if (!hA || !hB || !hA.length || !hB.length) return 0;
  var sum = 0;
  var len = Math.min(hA.length, hB.length);
  for (var i = 0; i < len; i++) sum += Math.sqrt((hA[i] || 0) * (hB[i] || 0));
  return sum;
}

function chiSquareHistDistance(hA, hB) {
  if (!hA || !hB) return 1;
  var d = 0;
  var len = Math.min(hA.length, hB.length);
  for (var i = 0; i < len; i++) {
    var a = hA[i] || 0;
    var b = hB[i] || 0;
    var diff = a - b;
    d += (diff * diff) / (a + b + 1e-6);
  }
  return d;
}

function hueHistogramSimilarity(hA, hB) {
  var bc = bhattacharyyaCoeff(hA, hB);
  var chiSim = 1 / (1 + chiSquareHistDistance(hA, hB));
  return 0.65 * bc + 0.35 * chiSim;
}

function extractFrameProfileFromImageData(data, width, height) {
  var hashes = computeImageHashesFromImageData(data, width, height);
  var hueHist = computeHueHistogram(data, width, height, VIDEO_HUE_BINS);
  var stats = computeFrameStats(data, width, height);
  return {
    dHash: hashes.dHash,
    colorHash: hashes.colorHash,
    detailHash: hashes.detailHash,
    hueHist: hueHist,
    luma: stats.luma,
    contrast: stats.contrast,
    saturation: stats.saturation
  };
}

function aggregateVideoHue(frames) {
  var sum = new Float64Array(VIDEO_HUE_BINS);
  for (var i = 0; i < frames.length; i++) {
    var h = frames[i].hueHist;
    if (!h) continue;
    for (var j = 0; j < VIDEO_HUE_BINS; j++) sum[j] += h[j] || 0;
  }
  var total = 0;
  for (var k = 0; k < VIDEO_HUE_BINS; k++) total += sum[k];
  if (total > 0) {
    for (var m = 0; m < VIDEO_HUE_BINS; m++) sum[m] /= total;
  }
  return Array.from(sum);
}

function compareVideoFrameProfiles(fA, fB, maxHamming) {
  if (!fA || !fB) return 0;
  var dDist = hammingDistanceHex(fA.dHash, fB.dHash);
  var cDist = hammingDistanceHex(fA.colorHash, fB.colorHash);
  if (Math.max(dDist, cDist) > maxHamming + 1) return 0;

  var hashScore = 1 - (dDist + cDist) / (2 * MEDIA_HASH_BITS);
  var hueScore = hueHistogramSimilarity(fA.hueHist, fB.hueHist);
  if (hueScore < 0.45) return 0;

  var lumaScore = 1 - Math.min(1, Math.abs((fA.luma || 0) - (fB.luma || 0)) / 0.35);
  var contrastScore = 1 - Math.min(1, Math.abs((fA.contrast || 0) - (fB.contrast || 0)) / 0.25);
  var satScore = 1 - Math.min(1, Math.abs((fA.saturation || 0) - (fB.saturation || 0)) / 0.4);

  return 0.42 * hashScore + 0.38 * hueScore + 0.08 * lumaScore + 0.07 * contrastScore + 0.05 * satScore;
}

function bandedDtwVideoSimilarity(profilesA, profilesB, options) {
  var n = profilesA.length;
  var m = profilesB.length;
  if (!n || !m) return 0;

  var band = Math.max(1, Math.floor(Math.max(n, m) * 0.22));
  var maxHamming = maxHammingFromSimilarity((options && options.similarity) || 92);
  var INF = 1e9;
  var dp = [];
  var i, j, i2, j2, jStart, jEnd, frameScore, cost, best;

  for (i = 0; i <= n; i++) {
    dp[i] = new Float64Array(m + 1);
    for (j = 0; j <= m; j++) dp[i][j] = INF;
  }
  dp[0][0] = 0;

  for (i2 = 1; i2 <= n; i2++) {
    jStart = Math.max(1, i2 - band);
    jEnd = Math.min(m, i2 + band);
    for (j2 = jStart; j2 <= jEnd; j2++) {
      frameScore = compareVideoFrameProfiles(profilesA[i2 - 1], profilesB[j2 - 1], maxHamming);
      cost = 1 - frameScore;
      best = INF;
      if (i2 > 0 && dp[i2 - 1][j2] < INF) best = Math.min(best, dp[i2 - 1][j2] + cost);
      if (j2 > 0 && dp[i2][j2 - 1] < INF) best = Math.min(best, dp[i2][j2 - 1] + cost);
      if (i2 > 0 && j2 > 0 && dp[i2 - 1][j2 - 1] < INF) best = Math.min(best, dp[i2 - 1][j2 - 1] + cost);
      dp[i2][j2] = best;
    }
  }

  var pathCost = dp[n][m];
  if (!isFinite(pathCost) || pathCost >= INF) return 0;
  return Math.max(0, 1 - pathCost / (n + m));
}

function dedupeFrameProfiles(profiles, maxHamming) {
  var unique = [];
  for (var i = 0; i < profiles.length; i++) {
    var profile = profiles[i];
    var dup = false;
    for (var j = 0; j < unique.length; j++) {
      if (hammingDistanceHex(profile.dHash, unique[j].dHash) <= maxHamming &&
          hueHistogramSimilarity(profile.hueHist, unique[j].hueHist) > 0.88) {
        dup = true;
        break;
      }
    }
    if (!dup) unique.push(profile);
  }
  return unique;
}

function computeImageHashesFromImageData(data, width, height) {
  if (typeof document === 'undefined') {
    var grayFull = grayscaleFromImageData(data, width, height);
    var hashes = computeHashesFromGray(grayFull, width, height);
    var detail = subsampleGray(grayFull, width, height, 32, 32);
    var detailHashes = computeHashesFromGray(detail.gray, detail.width, detail.height);
    return {
      dHash: hashes.dHash,
      aHash: hashes.aHash,
      blockHash: hashes.aHash,
      detailHash: detailHashes.dHash,
      colorHash: colorLayoutHashFromGray(grayFull, width, height),
      scales: [hashes.dHash, hashes.aHash, detailHashes.dHash]
    };
  }

  var source = document.createElement('canvas');
  source.width = width;
  source.height = height;
  var sctx = source.getContext('2d', { willReadFrequently: true });
  var tmp = sctx.createImageData(width, height);
  tmp.data.set(data);
  sctx.putImageData(tmp, 0, 0);

  function sample(w, h) {
    var dest = document.createElement('canvas');
    dest.width = w;
    dest.height = h;
    var dctx = dest.getContext('2d', { willReadFrequently: true });
    dctx.drawImage(source, 0, 0, width, height, 0, 0, w, h);
    var sampled = dctx.getImageData(0, 0, w, h);
    return computeHashesFromGray(grayscaleFromImageData(sampled.data, w, h), w, h);
  }

  var small = sample(9, 8);
  var medium = sample(16, 16);
  var detail = sample(32, 32);
  return {
    dHash: small.dHash,
    aHash: small.aHash,
    blockHash: medium.aHash,
    detailHash: detail.dHash,
    colorHash: colorLayoutHashFromImageData(data, width, height),
    scales: [small.dHash, small.aHash, medium.dHash, medium.aHash, detail.dHash]
  };
}

function shouldIgnoreMediaPath(path, scope) {
  var parts = normalizePath(path).toLowerCase().split('/');
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i];
    if (!part) continue;
    if (scope.skipThumbs && /^(thumbs?|thumbnails|\.thumbnails|preview|previews|cache)$/.test(part)) return true;
    if (scope.skipDsStore && (part === '.ds_store' || part === '__macosx')) return true;
  }
  return false;
}

function dimensionCompatible(a, b, options) {
  if (!a.width || !a.height || !b.width || !b.height) return true;
  var aspectA = a.width / a.height;
  var aspectB = b.width / b.height;
  var aspectDiff = aspectA > aspectB ? aspectA / aspectB : aspectB / aspectA;
  if (options && options.allowResize) {
    return aspectDiff <= 3;
  }
  if (aspectDiff > 1.2) return false;
  var areaA = a.width * a.height;
  var areaB = b.width * b.height;
  if (!areaA || !areaB) return true;
  var ratio = areaA > areaB ? areaA / areaB : areaB / areaA;
  return ratio <= 1.08;
}

function collectHashLists(sig) {
  var list = [];
  if (!sig) return list;
  if (sig.dHash) list.push(sig.dHash);
  if (sig.aHash) list.push(sig.aHash);
  if (sig.blockHash) list.push(sig.blockHash);
  if (sig.detailHash) list.push(sig.detailHash);
  if (sig.colorHash) list.push(sig.colorHash);
  if (sig.frameHashes) list = list.concat(sig.frameHashes);
  return list;
}

function imageHashDistances(a, b) {
  var dists = [];
  if (a.dHash && b.dHash) dists.push(hammingDistanceHex(a.dHash, b.dHash));
  if (a.aHash && b.aHash) dists.push(hammingDistanceHex(a.aHash, b.aHash));
  if (a.blockHash && b.blockHash) dists.push(hammingDistanceHex(a.blockHash, b.blockHash));
  if (a.detailHash && b.detailHash) dists.push(hammingDistanceHex(a.detailHash, b.detailHash));
  if (a.colorHash && b.colorHash) dists.push(hammingDistanceHex(a.colorHash, b.colorHash));
  return dists;
}

function strictImageDistance(a, b) {
  var dists = imageHashDistances(a, b);
  if (!dists.length) return MEDIA_HASH_BITS;
  dists.sort(function(x, y) { return y - x; });
  if (dists.length === 1) return dists[0];
  return (dists[0] + dists[1]) / 2;
}

function passesStrictImageHashGate(a, b, maxHamming) {
  if (!a || !b || a.kind !== 'image' || b.kind !== 'image') return true;
  if (!a.dHash || !b.dHash || !a.aHash || !b.aHash) return false;
  var dDist = hammingDistanceHex(a.dHash, b.dHash);
  var aDist = hammingDistanceHex(a.aHash, b.aHash);
  if (Math.max(dDist, aDist) > maxHamming) return false;
  if (a.detailHash && b.detailHash) {
    if (hammingDistanceHex(a.detailHash, b.detailHash) > maxHamming) return false;
  }
  if (a.colorHash && b.colorHash) {
    if (hammingDistanceHex(a.colorHash, b.colorHash) > maxHamming + 2) return false;
  }
  return true;
}

function imageSimilarityScore(a, b, options) {
  if (!a || !b || a.error || b.error) return 0;
  if (a.exactHash && b.exactHash && a.exactHash === b.exactHash) return 1;
  if (a.kind !== 'image' || b.kind !== 'image') return 0;
  if (!dimensionCompatible(a, b, options)) return 0;

  var strictDist = strictImageDistance(a, b);
  return 1 - strictDist / MEDIA_HASH_BITS;
}

function passesStrictVideoGate(a, b) {
  if (!a || !b || a.kind !== 'video' || b.kind !== 'video') return true;
  if (a.aggregateHue && b.aggregateHue) {
    if (hueHistogramSimilarity(a.aggregateHue, b.aggregateHue) < 0.42) return false;
  }
  if (a.meanLuma != null && b.meanLuma != null) {
    if (Math.abs(a.meanLuma - b.meanLuma) > 0.28) return false;
  }
  if (a.meanSaturation != null && b.meanSaturation != null) {
    if (Math.abs(a.meanSaturation - b.meanSaturation) > 0.35) return false;
  }
  return true;
}

function legacyVideoHashSimilarity(a, b, options) {
  var framesA = a.uniqueFrameHashes || a.frameHashes || [];
  var framesB = b.uniqueFrameHashes || b.frameHashes || [];
  if (!framesA.length || !framesB.length) return 0;

  var maxHamming = maxHammingFromSimilarity((options && options.similarity) || 92);
  var matched = 0;
  for (var i = 0; i < framesA.length; i++) {
    var best = MEDIA_HASH_BITS;
    for (var j = 0; j < framesB.length; j++) {
      var d = hammingDistanceHex(framesA[i], framesB[j]);
      if (d < best) best = d;
      if (best === 0) break;
    }
    if (best <= maxHamming) matched++;
  }
  var coverage = matched / Math.max(framesA.length, framesB.length);
  var thumbDist = hammingDistanceHex(a.dHash, b.dHash);
  var thumbScore = 1 - thumbDist / MEDIA_HASH_BITS;
  return Math.max(coverage * 0.85 + thumbScore * 0.15, coverage);
}

function videoSimilarityScore(a, b, options) {
  if (!a || !b || a.error || b.error) return 0;
  if (a.exactHash && b.exactHash && a.exactHash === b.exactHash) return 1;
  if (a.kind !== 'video' || b.kind !== 'video') return 0;
  if (!dimensionCompatible(a, b, options)) return 0;

  var profilesA = a.uniqueFrameProfiles || a.frameProfiles || [];
  var profilesB = b.uniqueFrameProfiles || b.frameProfiles || [];

  if (profilesA.length && profilesB.length) {
    if (a.aggregateHue && b.aggregateHue) {
      var globalHue = hueHistogramSimilarity(a.aggregateHue, b.aggregateHue);
      if (globalHue < 0.4) return 0;
    }

    var dtwScore = bandedDtwVideoSimilarity(profilesA, profilesB, options);
    var durA = a.duration || 1;
    var durB = b.duration || 1;
    var durationRatio = Math.min(durA, durB) / Math.max(durA, durB);
    var durationFactor = durationRatio < 0.45 ? 0.5 + durationRatio : 1;

    return dtwScore * durationFactor;
  }

  return legacyVideoHashSimilarity(a, b, options);
}

function mediaSimilarityScore(a, b, options) {
  if (!a || !b || a.error || b.error) return 0;
  if (a.exactHash && b.exactHash && a.exactHash === b.exactHash) return 1;
  if (a.kind !== b.kind) return 0;
  if (a.kind === 'image') return imageSimilarityScore(a, b, options);
  if (a.kind === 'video') return videoSimilarityScore(a, b, options);
  return 0;
}

function mediaSignaturesSimilar(a, b, maxHamming, options) {
  if (options && Number(options.similarity) >= 100) {
    return !!(a.exactHash && b.exactHash && a.exactHash === b.exactHash);
  }
  if (!passesStrictImageHashGate(a, b, maxHamming)) return false;
  if (!passesStrictVideoGate(a, b)) return false;
  var minScore = options && options.minScore != null
    ? options.minScore
    : minSimilarityScoreFromSlider(options && options.similarity);
  return mediaSimilarityScore(a, b, options) >= minScore;
}

function UnionFind(size) {
  var parent = [];
  var rank = [];
  for (var i = 0; i < size; i++) { parent[i] = i; rank[i] = 0; }
  this.find = function(x) {
    if (parent[x] !== x) parent[x] = this.find(parent[x]);
    return parent[x];
  };
  this.union = function(a, b) {
    var ra = this.find(a);
    var rb = this.find(b);
    if (ra === rb) return;
    if (rank[ra] < rank[rb]) parent[ra] = rb;
    else if (rank[ra] > rank[rb]) parent[rb] = ra;
    else { parent[rb] = ra; rank[ra]++; }
  };
}

function buildCandidatePairs(items, maxHamming) {
  var bands = {};
  var compared = {};
  var pairs = [];

  function pairKey(a, b) { return a < b ? a + ':' + b : b + ':' + a; }
  function addPair(i, j) {
    if (i === j) return;
    var pk = pairKey(i, j);
    if (compared[pk]) return;
    compared[pk] = true;
    pairs.push([i, j]);
  }

  for (var i = 0; i < items.length; i++) {
    var sig = items[i].sig;
    if (!sig || sig.error) continue;
    if (sig.exactHash) {
      var ek = 'exact:' + sig.exactHash;
      if (!bands[ek]) bands[ek] = [];
      bands[ek].push(i);
    }
    var hashes = collectHashLists(sig);
    for (var h = 0; h < hashes.length; h++) {
      var hash = padHashHex(hashes[h]);
      for (var b = 0; b < MEDIA_BANDS; b++) {
        var start = b * 4;
        var band = hash.slice(start, start + 4);
        var key = b + ':' + band;
        if (!bands[key]) bands[key] = [];
        bands[key].push(i);
      }
    }
  }

  Object.keys(bands).forEach(function(key) {
    var bucket = bands[key];
    if (bucket.length < 2) return;
    if (key.indexOf('exact:') === 0) {
      for (var a = 0; a < bucket.length; a++) {
        for (var b = a + 1; b < bucket.length; b++) addPair(bucket[a], bucket[b]);
      }
      return;
    }
    for (var x = 0; x < bucket.length; x++) {
      for (var y = x + 1; y < bucket.length; y++) addPair(bucket[x], bucket[y]);
    }
  });

  return pairs;
}

function clusterMediaSignatures(items, options) {
  var n = items.length;
  var uf = new UnionFind(n);
  var maxHamming = maxHammingFromSimilarity(options && options.similarity);
  var pairs = buildCandidatePairs(items, maxHamming);

  for (var p = 0; p < pairs.length; p++) {
    var i = pairs[p][0];
    var j = pairs[p][1];
    if (mediaSignaturesSimilar(items[i].sig, items[j].sig, maxHamming, options)) {
      uf.union(i, j);
    }
  }

  var clusters = {};
  for (var c = 0; c < n; c++) {
    var root = uf.find(c);
    if (!clusters[root]) clusters[root] = [];
    clusters[root].push(c);
  }
  return Object.keys(clusters).map(function(k) { return clusters[k]; });
}

function naturalPathCompare(a, b) {
  if (typeof a !== 'string') a = a.path || '';
  if (typeof b !== 'string') b = b.path || '';
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function pickCanonicalMediaItem(indices, items, strategy) {
  var candidates = indices.map(function(i) { return items[i]; }).filter(function(it) {
    return !it.deleted && !it.skip;
  });
  if (!candidates.length) return items[indices[0]];

  candidates.sort(function(a, b) {
    if (strategy === 'largest') {
      var sizeA = (a.sig && a.sig.byteSize) || 0;
      var sizeB = (b.sig && b.sig.byteSize) || 0;
      if (sizeB !== sizeA) return sizeB - sizeA;
      var pxA = ((a.sig && a.sig.width) || 0) * ((a.sig && a.sig.height) || 0);
      var pxB = ((b.sig && b.sig.width) || 0) * ((b.sig && b.sig.height) || 0);
      if (pxB !== pxA) return pxB - pxA;
    }
    return naturalPathCompare(a.path, b.path);
  });
  return candidates[0];
}

function parentDir(path) {
  var parts = path.split('/');
  parts.pop();
  return parts.join('/') || '';
}

function collapseBurstSequences(items, options, report, stats, burstPreviewGroups) {
  if (Number(options.similarity) >= 100) return;
  var maxHamming = maxHammingFromSimilarity(options.similarity);
  var maxKeep = Math.max(1, Number(options.maxBurstKeep) || 2);
  var byDir = {};

  items.forEach(function(it, idx) {
    if (it.deleted || it.skip || !it.sig || it.sig.error || it.sig.kind !== 'image') return;
    var dir = parentDir(it.path);
    if (!byDir[dir]) byDir[dir] = [];
    byDir[dir].push(idx);
  });

  Object.keys(byDir).forEach(function(dir) {
    var indices = byDir[dir];
    indices.sort(function(a, b) { return naturalPathCompare(items[a].path, items[b].path); });

    var run = [];
    function flushRun() {
      if (run.length < 2) { run = []; return; }
      stats.burstClusters++;
      var keepIdx = selectBurstRepresentatives(run, items, maxKeep);
      var keepSet = {};
      keepIdx.forEach(function(i) { keepSet[i] = true; });
      run.forEach(function(idx) {
        if (keepSet[idx] || items[idx].deleted) return;
        items[idx].deleted = true;
        stats.filesRemoved++;
        var score = mediaSimilarityScore(items[idx].sig, items[keepIdx[0]].sig, options);
        report.push('Burst duplicate removed: ' + items[idx].path +
          ' (' + Math.round(score * 100) + '% match, kept ' + items[keepIdx[0]].path + ')');
      });
      if (burstPreviewGroups) {
        var removedEntries = run.filter(function(idx) { return !keepSet[idx]; })
          .map(function(idx) { return mediaPreviewEntry(items[idx]); })
          .filter(Boolean);
        var keptEntries = keepIdx.map(function(idx) { return mediaPreviewEntry(items[idx]); }).filter(Boolean);
        if (keptEntries.length && removedEntries.length) {
          burstPreviewGroups.push({
            type: 'burst',
            kept: keptEntries,
            removed: removedEntries
          });
        }
      }
      run = [];
    }

    for (var i = 0; i < indices.length; i++) {
      if (!run.length) { run.push(indices[i]); continue; }
      var prev = items[run[run.length - 1]];
      var cur = items[indices[i]];
      if (mediaSignaturesSimilar(prev.sig, cur.sig, maxHamming, options)) {
        run.push(indices[i]);
      } else {
        flushRun();
        run = [indices[i]];
      }
    }
    flushRun();
  });
}

function selectBurstRepresentatives(runIndices, items, maxKeep) {
  if (runIndices.length <= maxKeep) return runIndices.slice();
  var kept = [runIndices[0]];
  if (maxKeep >= 2) kept.push(runIndices[runIndices.length - 1]);
  if (maxKeep >= 3 && runIndices.length > 2) {
    var mid = runIndices[Math.floor(runIndices.length / 2)];
    if (kept.indexOf(mid) === -1) kept.push(mid);
  }
  kept.sort(function(a, b) { return a - b; });
  return kept.slice(0, maxKeep);
}

function dedupeFrameHashes(frameHashes, maxHamming) {
  var unique = [];
  for (var i = 0; i < frameHashes.length; i++) {
    var hash = frameHashes[i];
    var dup = false;
    for (var j = 0; j < unique.length; j++) {
      if (hammingDistanceHex(hash, unique[j]) <= maxHamming) { dup = true; break; }
    }
    if (!dup) unique.push(hash);
  }
  return unique;
}

function buildMediaManifest(files, projectName) {
  if (!files.length) return '';
  var images = 0;
  var videos = 0;
  var bytes = 0;
  files.forEach(function(f) {
    if (isMediaImagePath(f.path)) images++;
    else if (isMediaVideoPath(f.path)) videos++;
    if (f.binaryData && f.binaryData.byteLength) bytes += f.binaryData.byteLength;
  });
  var mb = (bytes / (1024 * 1024)).toFixed(1);
  var lines = [
    (projectName || 'media') + '/  (' + files.length + ' files, ' + images + ' images, ' + videos + ' videos, ' + mb + ' MB)'
  ];
  var n = Math.min(files.length, 24);
  for (var i = 0; i < n; i++) lines.push(files[i].path);
  if (files.length > n) lines.push('... +' + (files.length - n) + ' more files');
  return lines.join('\n');
}

function buildMediaReportText(result, elapsedMs) {
  var s = result.stats;
  var lines = [];
  lines.push('Variation dedupe complete');
  lines.push('');
  lines.push('Media scanned: ' + s.totalMedia);
  if (s.images) lines.push('  Images: ' + s.images);
  if (s.videos) lines.push('  Videos: ' + s.videos);
  if (s.bytesAnalyzed) lines.push('  Data analyzed: ' + (s.bytesAnalyzed / (1024 * 1024)).toFixed(1) + ' MB');
  if (s.targetMode && s.targetPath) lines.push('Reference target: ' + s.targetPath);
  if (s.filesRemoved) lines.push('Duplicates removed: ' + s.filesRemoved);
  if (s.variationClusters) lines.push('Variation groups: ' + s.variationClusters);
  if (s.burstClusters) lines.push('Burst sequences collapsed: ' + s.burstClusters);
  if (s.passthroughFiles) lines.push('Left unchanged: ' + s.passthroughFiles);
  if (s.keptFiles) lines.push('Files kept: ' + s.keptFiles);
  if (s.errors) lines.push('Errors: ' + s.errors);
  lines.push('Match threshold: ' + (s.similarityThreshold != null ? s.similarityThreshold : 'n/a') + '%');
  lines.push('Completed in ' + elapsedMs + 'ms');
  lines.push('');

  if (result.clusters && result.clusters.length) {
    lines.push('Duplicate groups:');
    result.clusters.slice(0, 40).forEach(function(cluster, idx) {
      lines.push('  Group ' + (idx + 1) + ' (kept ' + cluster.kept + '):');
      cluster.removed.slice(0, 8).forEach(function(p) { lines.push('    - ' + p); });
      if (cluster.removed.length > 8) lines.push('    ... +' + (cluster.removed.length - 8) + ' more');
    });
    if (result.clusters.length > 40) lines.push('  ... +' + (result.clusters.length - 40) + ' more groups');
    lines.push('');
  }

  var changes = result.report.filter(function(r) {
    return /removed|duplicate|Burst|Variation/i.test(r);
  });
  if (changes.length) {
    lines.push('Log:');
    changes.slice(0, 80).forEach(function(r) { lines.push('  ' + r); });
    if (changes.length > 80) lines.push('  ... +' + (changes.length - 80) + ' more');
  } else {
    lines.push('No variation duplicates found.');
  }
  return lines.join('\n');
}

function mediaPreviewEntry(item) {
  if (!item || !item.binaryData) return null;
  var kind = (item.sig && item.sig.kind) || (isMediaVideoPath(item.path) ? 'video' : 'image');
  return {
    path: item.path,
    kind: kind,
    binaryData: item.binaryData
  };
}

function buildMediaPreviewGroups(allFiles, clusterSummaries, burstPreviewGroups) {
  var byPath = {};
  allFiles.forEach(function(f) { byPath[f.path] = f; });
  var groups = (burstPreviewGroups || []).slice();
  (clusterSummaries || []).forEach(function(c) {
    var kept = mediaPreviewEntry(byPath[c.kept]);
    var removed = (c.removed || []).map(function(p) { return mediaPreviewEntry(byPath[p]); }).filter(Boolean);
    if (kept && removed.length) {
      groups.push({ type: 'variation', kept: [kept], removed: removed });
    }
  });
  return groups;
}

function mediaPathsEqual(a, b) {
  return normalizePath(a || '') === normalizePath(b || '');
}

function resolveMediaTarget(analyzed, options) {
  var targetPath = normalizePath(options.targetPath || '');
  if (!targetPath) return null;

  for (var i = 0; i < analyzed.length; i++) {
    if (mediaPathsEqual(analyzed[i].path, targetPath)) {
      return { entry: analyzed[i], external: false };
    }
  }

  if (options.targetSig && options.targetBinary) {
    return {
      entry: {
        path: targetPath,
        binaryData: options.targetBinary,
        sig: options.targetSig
      },
      external: true
    };
  }
  return null;
}

function processMediaTargetResults(passthroughFiles, analyzed, options) {
  var report = [];
  var clusterSummaries = [];
  var stats = {
    totalMedia: 0,
    images: 0,
    videos: 0,
    bytesAnalyzed: 0,
    filesRemoved: 0,
    variationClusters: 0,
    burstClusters: 0,
    errors: 0,
    keptFiles: 0,
    passthroughFiles: 0,
    similarityThreshold: options.similarity,
    targetMode: true,
    targetPath: options.targetPath
  };

  options = Object.assign({ allowResize: true, similarity: 92 }, options || {});
  var targetInfo = resolveMediaTarget(analyzed, options);
  var passthrough = (passthroughFiles || []).filter(function(f) { return f.passthrough; });

  if (!targetInfo) {
    report.push('Error: reference target not found: ' + (options.targetPath || '(none)'));
    stats.errors++;
    stats.passthroughFiles = passthrough.length;
    stats.keptFiles = analyzed.length + passthrough.length;
    return {
      files: analyzed.map(function(e) {
        return { path: e.path, binary: true, binaryData: e.binaryData, deleted: false };
      }).concat(passthrough),
      allFiles: [],
      clusters: [],
      previewGroups: [],
      report: report,
      stats: stats
    };
  }

  var targetEntry = targetInfo.entry;
  var targetSig = targetEntry.sig || {};
  if (targetSig.error) {
    report.push('Error: could not analyze target: ' + targetSig.error);
    stats.errors++;
    stats.passthroughFiles = passthrough.length;
    stats.keptFiles = analyzed.length + passthrough.length;
    return {
      files: analyzed.map(function(e) {
        return { path: e.path, binary: true, binaryData: e.binaryData, deleted: false };
      }).concat(passthrough),
      allFiles: [],
      clusters: [],
      previewGroups: [],
      report: report,
      stats: stats
    };
  }

  var targetPath = normalizePath(options.targetPath);
  var maxHamming = maxHammingFromSimilarity(options.similarity);
  var working = analyzed.map(function(entry) {
    return {
      path: entry.path,
      binary: true,
      binaryData: entry.binaryData,
      skip: !!entry.skip,
      deleted: false,
      sig: entry.sig || { error: entry.error || 'No signature' }
    };
  });

  working.forEach(function(w) {
    if (w.sig.error) {
      stats.errors++;
      report.push('Error: ' + w.path + ': ' + w.sig.error);
      return;
    }
    stats.totalMedia++;
    stats.bytesAnalyzed += w.sig.byteSize || 0;
    if (w.sig.kind === 'image') stats.images++;
    if (w.sig.kind === 'video') stats.videos++;
  });

  report.push('Reference target mode: keeping ' + targetPath + ' at ' + options.similarity + '% threshold');

  var removedPaths = [];
  working.forEach(function(w) {
    if (w.sig.error || w.deleted || w.skip) return;
    if (mediaPathsEqual(w.path, targetPath)) return;
    if (w.sig.kind !== targetSig.kind) return;
    if (!mediaSignaturesSimilar(targetSig, w.sig, maxHamming, options)) return;

    w.deleted = true;
    stats.filesRemoved++;
    removedPaths.push(w.path);
    var score = mediaSimilarityScore(targetSig, w.sig, options);
    report.push('Target variation removed: ' + w.path +
      ' (' + Math.round(score * 100) + '% match, kept ' + targetPath + ')');
  });

  if (removedPaths.length) {
    stats.variationClusters = 1;
    clusterSummaries.push({ kept: targetPath, removed: removedPaths });
  }

  stats.passthroughFiles = passthrough.length;
  if (stats.passthroughFiles) {
    report.push('Left unchanged: ' + stats.passthroughFiles + ' file(s) matched your skip list');
  }

  var kept = working.filter(function(w) { return !w.deleted; });
  if (!kept.some(function(w) { return mediaPathsEqual(w.path, targetPath); }) && targetEntry.binaryData) {
    kept.unshift({
      path: targetPath,
      binary: true,
      binaryData: targetEntry.binaryData,
      deleted: false,
      sig: targetSig
    });
  }
  kept = kept.concat(passthrough);
  stats.keptFiles = kept.length;

  var byPath = {};
  working.forEach(function(f) { byPath[f.path] = f; });
  if (!byPath[targetPath] && targetEntry.binaryData) {
    byPath[targetPath] = {
      path: targetPath,
      binary: true,
      binaryData: targetEntry.binaryData,
      sig: targetSig
    };
  }

  var previewGroups = [];
  if (removedPaths.length) {
    var targetPreview = mediaPreviewEntry(byPath[targetPath] || targetEntry);
    var removedPreview = removedPaths.map(function(p) { return mediaPreviewEntry(byPath[p]); }).filter(Boolean);
    if (targetPreview && removedPreview.length) {
      previewGroups.push({ type: 'target', kept: [targetPreview], removed: removedPreview });
    }
  }

  return {
    files: kept,
    allFiles: working,
    clusters: clusterSummaries,
    previewGroups: previewGroups,
    report: report,
    stats: stats
  };
}

function processMediaAnalysisResults(passthroughFiles, analyzed, options) {
  options = Object.assign({ allowResize: true, similarity: 92 }, options || {});
  if (options.useTargetReference && options.targetPath) {
    return processMediaTargetResults(passthroughFiles, analyzed, options);
  }

  var report = [];
  var clusterSummaries = [];
  var stats = {
    totalMedia: 0,
    images: 0,
    videos: 0,
    bytesAnalyzed: 0,
    filesRemoved: 0,
    variationClusters: 0,
    burstClusters: 0,
    errors: 0,
    keptFiles: 0,
    passthroughFiles: 0,
    similarityThreshold: options.similarity
  };

  var working = analyzed.map(function(entry) {
    return {
      path: entry.path,
      binary: true,
      binaryData: entry.binaryData,
      skip: !!entry.skip,
      deleted: false,
      sig: entry.sig || { error: entry.error || 'No signature' }
    };
  });

  working.forEach(function(w) {
    if (w.sig.error) {
      stats.errors++;
      report.push('Error: ' + w.path + ': ' + w.sig.error);
      return;
    }
    stats.totalMedia++;
    stats.bytesAnalyzed += w.sig.byteSize || 0;
    if (w.sig.kind === 'image') stats.images++;
    if (w.sig.kind === 'video') stats.videos++;
  });

  report.push('Analyzed ' + stats.totalMedia + ' media file(s) at ' + options.similarity + '% threshold');

  var burstPreviewGroups = [];
  if (options.collapseBursts) {
    collapseBurstSequences(working, options, report, stats, burstPreviewGroups);
  }

  var clusterIndices = clusterMediaSignatures(working, options);
  clusterIndices.forEach(function(cluster) {
    if (cluster.length < 2) return;
    var active = cluster.filter(function(i) { return !working[i].deleted && !working[i].skip; });
    if (active.length < 2) return;
    stats.variationClusters++;
    var canonical = pickCanonicalMediaItem(cluster, working, options.keepLargest ? 'largest' : 'shortest');
    var removedPaths = [];
    cluster.forEach(function(idx) {
      var item = working[idx];
      if (item === canonical || item.deleted || item.skip) return;
      item.deleted = true;
      stats.filesRemoved++;
      removedPaths.push(item.path);
      var score = mediaSimilarityScore(item.sig, canonical.sig, options);
      report.push('Variation duplicate removed: ' + item.path +
        ' (' + Math.round(score * 100) + '% match, kept ' + canonical.path + ')');
    });
    if (removedPaths.length) {
      clusterSummaries.push({ kept: canonical.path, removed: removedPaths });
    }
  });

  var passthrough = (passthroughFiles || []).filter(function(f) { return f.passthrough; });
  stats.passthroughFiles = passthrough.length;
  if (stats.passthroughFiles) {
    report.push('Left unchanged: ' + stats.passthroughFiles + ' file(s) matched your skip list');
  }
  var kept = working.filter(function(w) { return !w.deleted; }).concat(passthrough);
  stats.keptFiles = kept.length;
  var previewGroups = buildMediaPreviewGroups(working, clusterSummaries, burstPreviewGroups);

  return {
    files: kept,
    allFiles: working,
    clusters: clusterSummaries,
    previewGroups: previewGroups,
    report: report,
    stats: stats
  };
}

async function sha256Buffer(buffer) {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    var hash = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hash)).map(function(b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }
  var h = 2166136261;
  var view = new Uint8Array(buffer);
  for (var i = 0; i < view.length; i++) {
    h ^= view[i];
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function loadImageElementFromBuffer(buffer, mime) {
  return new Promise(function(resolve, reject) {
    if (typeof document === 'undefined') {
      reject(new Error('Image decode requires browser'));
      return;
    }
    var blob = new Blob([buffer], { type: mime });
    var url = URL.createObjectURL(blob);
    var img = new Image();
    img.onload = function() {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = function() {
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode image'));
    };
    img.src = url;
  });
}

function imageDataFromImage(img) {
  var canvas = document.createElement('canvas');
  var w = img.naturalWidth || img.width;
  var h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error('Invalid image dimensions');
  canvas.width = w;
  canvas.height = h;
  var ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  return { data: ctx.getImageData(0, 0, w, h).data, width: w, height: h };
}

async function analyzeImageBuffer(buffer, path) {
  var mime = mimeFromMediaPath(path);
  var exactHash = await sha256Buffer(buffer);
  try {
    var img = await loadImageElementFromBuffer(buffer, mime);
    var sampled = imageDataFromImage(img);
    var hashes = computeImageHashesFromImageData(sampled.data, sampled.width, sampled.height);
    return {
      kind: 'image',
      exactHash: exactHash,
      dHash: hashes.dHash,
      aHash: hashes.aHash,
      blockHash: hashes.blockHash,
      detailHash: hashes.detailHash,
      colorHash: hashes.colorHash,
      scales: hashes.scales,
      width: sampled.width,
      height: sampled.height,
      byteSize: buffer.byteLength
    };
  } catch (e) {
    return { kind: 'image', exactHash: exactHash, error: e.message, byteSize: buffer.byteLength };
  }
}

function loadVideoElementFromBuffer(buffer, mime) {
  return new Promise(function(resolve, reject) {
    if (typeof document === 'undefined') {
      reject(new Error('Video decode requires browser'));
      return;
    }
    var blob = new Blob([buffer], { type: mime });
    var url = URL.createObjectURL(blob);
    var video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onloadedmetadata = function() { resolve({ video: video, url: url }); };
    video.onerror = function() {
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode video'));
    };
    video.src = url;
  });
}

function seekVideo(video, time) {
  return new Promise(function(resolve) {
    var settled = false;
    function finish() {
      if (settled) return;
      settled = true;
      video.removeEventListener('seeked', finish);
      resolve();
    }
    video.addEventListener('seeked', finish);
    try {
      var target = Math.max(0, Math.min(time, Math.max(0, (video.duration || 1) - 0.04)));
      if (Math.abs(video.currentTime - target) < 0.02) {
        finish();
        return;
      }
      video.currentTime = target;
    } catch (e) {
      finish();
      return;
    }
    setTimeout(finish, 1200);
  });
}

function frameProfileFromVideo(video) {
  var canvas = document.createElement('canvas');
  var w = video.videoWidth;
  var h = video.videoHeight;
  if (!w || !h) return null;
  canvas.width = w;
  canvas.height = h;
  var ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, w, h);
  var img = ctx.getImageData(0, 0, w, h);
  return extractFrameProfileFromImageData(img.data, w, h);
}

async function analyzeVideoBuffer(buffer, path, options) {
  options = options || {};
  var mime = mimeFromMediaPath(path);
  var exactHash = await sha256Buffer(buffer);
  var maxHamming = maxHammingFromSimilarity(options.similarity || 92);
  var loaded;

  try {
    loaded = await loadVideoElementFromBuffer(buffer, mime);
  } catch (e) {
    return { kind: 'video', exactHash: exactHash, error: e.message, byteSize: buffer.byteLength };
  }

  var video = loaded.video;
  var url = loaded.url;
  var frameProfiles = [];
  var frameHashes = [];
  var duration = video.duration;
  if (!duration || !isFinite(duration)) duration = 1;

  var burstMode = options.collapseBursts !== false;
  var intervalMs = burstMode ? Math.max(33, options.frameIntervalMs || 100) : Math.max(200, options.frameIntervalMs || 400);
  var maxFrames = options.maxVideoFrames || (burstMode ? 120 : 48);
  var step = intervalMs / 1000;
  var samples = Math.min(maxFrames, Math.max(1, Math.ceil(duration / step)));
  var lastHash = null;
  var sumLuma = 0;
  var sumContrast = 0;
  var sumSaturation = 0;

  for (var i = 0; i < samples; i++) {
    var t = samples === 1 ? 0 : (i / (samples - 1)) * Math.max(0, duration - 0.05);
    await seekVideo(video, t);
    var profile = frameProfileFromVideo(video);
    if (!profile) continue;
    profile.t = samples === 1 ? 0 : i / Math.max(1, samples - 1);
    if (lastHash && hammingDistanceHex(profile.dHash, lastHash) <= 1) continue;
    frameProfiles.push(profile);
    frameHashes.push(profile.dHash);
    sumLuma += profile.luma || 0;
    sumContrast += profile.contrast || 0;
    sumSaturation += profile.saturation || 0;
    lastHash = profile.dHash;
  }

  video.removeAttribute('src');
  video.load();
  URL.revokeObjectURL(url);

  if (!frameProfiles.length) {
    return { kind: 'video', exactHash: exactHash, error: 'No video frames decoded', byteSize: buffer.byteLength };
  }

  var uniqueFrameHashes = dedupeFrameHashes(frameHashes, maxHamming);
  var uniqueFrameProfiles = dedupeFrameProfiles(frameProfiles, maxHamming);
  var n = frameProfiles.length;
  var videoWidth = video.videoWidth;
  var videoHeight = video.videoHeight;

  return {
    kind: 'video',
    exactHash: exactHash,
    dHash: frameHashes[0],
    frameHashes: frameHashes,
    uniqueFrameHashes: uniqueFrameHashes,
    frameProfiles: frameProfiles,
    uniqueFrameProfiles: uniqueFrameProfiles,
    aggregateHue: aggregateVideoHue(frameProfiles),
    meanLuma: sumLuma / n,
    meanContrast: sumContrast / n,
    meanSaturation: sumSaturation / n,
    frameCount: frameProfiles.length,
    duration: duration,
    width: videoWidth,
    height: videoHeight,
    byteSize: buffer.byteLength
  };
}

async function analyzeMediaFile(file, options) {
  var buffer = file.binaryData;
  if (!buffer) return { error: 'Missing binary data' };
  if (isMediaImagePath(file.path)) return analyzeImageBuffer(buffer, file.path);
  if (isMediaVideoPath(file.path)) return analyzeVideoBuffer(buffer, file.path, options);
  return { error: 'Not a media file' };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MEDIA_IMAGE_EXTS: MEDIA_IMAGE_EXTS,
    MEDIA_VIDEO_EXTS: MEDIA_VIDEO_EXTS,
    MEDIA_HASH_BITS: MEDIA_HASH_BITS,
    isMediaPath: isMediaPath,
    isMediaImagePath: isMediaImagePath,
    isMediaVideoPath: isMediaVideoPath,
    shouldIgnoreMediaPath: shouldIgnoreMediaPath,
    hammingDistanceHex: hammingDistanceHex,
    maxHammingFromSimilarity: maxHammingFromSimilarity,
    mediaSimilarityScore: mediaSimilarityScore,
    mediaSignaturesSimilar: mediaSignaturesSimilar,
    videoSignaturesSimilar: function(a, b, maxHamming) {
      return videoSimilarityScore(a, b, { similarity: 100 - maxHamming * 2 }) >= 0.65;
    },
    clusterMediaSignatures: clusterMediaSignatures,
    collapseBurstSequences: collapseBurstSequences,
    processMediaAnalysisResults: processMediaAnalysisResults,
    processMediaTargetResults: processMediaTargetResults,
    buildMediaReportText: buildMediaReportText,
    buildMediaManifest: buildMediaManifest,
    mediaPreviewEntry: mediaPreviewEntry,
    buildMediaPreviewGroups: buildMediaPreviewGroups,
    computeImageHashesFromImageData: computeImageHashesFromImageData,
    dHashFromGrayscale: dHashFromGrayscale,
    bitsToHex: bitsToHex,
    naturalPathCompare: naturalPathCompare,
    dedupeFrameHashes: dedupeFrameHashes,
    dedupeFrameProfiles: dedupeFrameProfiles,
    dimensionCompatible: dimensionCompatible,
    bhattacharyyaCoeff: bhattacharyyaCoeff,
    hueHistogramSimilarity: hueHistogramSimilarity,
    compareVideoFrameProfiles: compareVideoFrameProfiles,
    bandedDtwVideoSimilarity: bandedDtwVideoSimilarity,
    aggregateVideoHue: aggregateVideoHue
  };
}
