// Shared helpers for Img/Vid Playwright tests

export async function gotoMediaTab(page) {
  await page.goto('/');
  await page.locator('#t-5').click();
  await page.waitForFunction(() => typeof processMediaAnalysisResults === 'function');
}

export async function resetMediaWorkspace(page) {
  await page.evaluate(() => {
    if (typeof clearMediaProject === 'function') clearMediaProject();
    else {
      mediaProjectFiles = [];
      mediaProcessedResult = null;
      mediaTargetRef = null;
      var useCb = document.getElementById('media-use-target');
      if (useCb) useCb.checked = false;
      if (typeof updateMediaTargetUi === 'function') updateMediaTargetUi();
    }
  });
}

export async function loadSyntheticMediaProject(page, filePaths) {
  return page.evaluate((paths) => {
    mediaProjectFiles = paths.map(function(p) {
      return {
        path: p,
        binary: true,
        binaryData: new ArrayBuffer(16),
        content: null
      };
    });
    mediaProjectName = 'synthetic-project';
    mediaProcessedResult = null;
    updateMediaManifest();
    if (typeof updateMediaTargetUi === 'function') updateMediaTargetUi();
    return mediaProjectFiles.length;
  }, filePaths);
}

export async function loadFixtureBuffers(page, entries) {
  return page.evaluate(async (items) => {
    async function loadBuffer(url) {
      var r = await fetch(url);
      if (!r.ok) throw new Error('Could not load ' + url);
      return r.arrayBuffer();
    }

    mediaProjectFiles = [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var buf = await loadBuffer(item.url);
      mediaProjectFiles.push({
        path: item.path,
        binary: true,
        binaryData: buf,
        content: null
      });
    }
    mediaProjectName = 'fixture-project';
    mediaProcessedResult = null;
    updateMediaManifest();
    if (typeof updateMediaTargetUi === 'function') updateMediaTargetUi();
    return mediaProjectFiles.map(function(f) { return f.path; });
  }, entries);
}

export async function setMediaTargetFromPath(page, path) {
  return page.evaluate((targetPath) => {
    setMediaTargetFromLibrary(targetPath);
    return {
      path: mediaTargetRef && mediaTargetRef.path,
      checked: document.getElementById('media-use-target').checked
    };
  }, path);
}

export async function enableMediaTargetMode(page, enabled) {
  await page.locator('#media-use-target').setChecked(enabled);
  await page.evaluate(() => {
    if (typeof onMediaTargetToggle === 'function') onMediaTargetToggle();
  });
}

export async function runMediaDedupe(page) {
  return page.evaluate(async () => {
    await deduplicateMedia();
    if (!mediaProcessedResult) {
      return { ran: true, result: null };
    }
    return {
      ran: true,
      result: {
        keptPaths: mediaProcessedResult.files.map(function(f) { return f.path; }).sort(),
        removed: mediaProcessedResult.stats.filesRemoved,
        kept: mediaProcessedResult.stats.keptFiles,
        targetMode: !!mediaProcessedResult.stats.targetMode,
        targetPath: mediaProcessedResult.stats.targetPath || null,
        clusters: mediaProcessedResult.clusters,
        previewGroups: (mediaProcessedResult.previewGroups || []).length,
        report: mediaProcessedResult.report.slice(0, 12)
      }
    };
  });
}

export async function runMediaEngine(page, analyzed, passthrough, options) {
  return page.evaluate(({ analyzed, passthrough, options }) => {
    var result = processMediaAnalysisResults(passthrough || [], analyzed, options);
    return {
      removed: result.stats.filesRemoved,
      kept: result.stats.keptFiles,
      targetMode: !!result.stats.targetMode,
      keptPaths: result.files.map(function(f) { return f.path; }).sort(),
      clusters: result.clusters,
      previewGroups: (result.previewGroups || []).length,
      report: result.report.filter(function(r) {
        return /Target|Variation|Burst|Reference/i.test(r);
      })
    };
  }, { analyzed, passthrough, options });
}

export function makeImageAnalyzed(path, hashHex, exactHash, width, height) {
  return {
    path,
    binaryData: new ArrayBuffer(8),
    sig: {
      kind: 'image',
      dHash: hashHex,
      aHash: hashHex,
      blockHash: hashHex,
      detailHash: hashHex,
      colorHash: hashHex,
      scales: [hashHex],
      exactHash: exactHash || hashHex,
      width: width || 1920,
      height: height || 1080,
      byteSize: (width || 1920) * (height || 1080)
    }
  };
}

export function makeVideoAnalyzed(path, hashHex, exactHash) {
  var warmHue = [0.55, 0.2, 0.05, 0.02, 0.03, 0.04, 0.03, 0.02, 0.02, 0.02, 0.01, 0.01];
  var frame = {
    dHash: hashHex,
    colorHash: hashHex,
    detailHash: hashHex,
    hueHist: warmHue,
    luma: 0.42,
    contrast: 0.18,
    saturation: 0.35,
    t: 0
  };
  return {
    path,
    binaryData: new ArrayBuffer(8),
    sig: {
      kind: 'video',
      dHash: hashHex,
      frameHashes: [hashHex],
      uniqueFrameHashes: [hashHex],
      frameProfiles: [frame],
      uniqueFrameProfiles: [frame],
      aggregateHue: warmHue,
      meanLuma: 0.42,
      meanContrast: 0.18,
      meanSaturation: 0.35,
      duration: 5,
      width: 1920,
      height: 1080,
      exactHash: exactHash || hashHex,
      byteSize: 5000000
    }
  };
}
