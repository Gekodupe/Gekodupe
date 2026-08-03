// Geckodupe Img / Vid tab

var mediaProjectFiles = [];
var mediaProcessedResult = null;
var mediaActivityCount = 0;
var mediaProjectName = '';
var mediaIsLoading = false;
var mediaRunToken = 0;
var mediaTargetRef = null;
var MEDIA_ANALYSIS_CONCURRENCY = 3;
var MEDIA_LOAD_BATCH = 8;
var MEDIA_WARN_FILES = 2000;
var MEDIA_MAX_FILES = 8000;
var MEDIA_WARN_BYTES = 4 * 1024 * 1024 * 1024;
var MEDIA_MAX_BYTES = 10 * 1024 * 1024 * 1024;

function logMediaActivity(msg) {
  var contentEl = document.getElementById('media-activity-log-content');
  var badgeEl = document.getElementById('media-activity-log-badge');
  if (!contentEl) return;
  var now = new Date();
  var timeStr = '[' + now.toTimeString().split(' ')[0] + '.' + ('00' + now.getMilliseconds()).slice(-3) + ']';
  var entry = document.createElement('div');
  entry.className = 'activity-entry';
  entry.innerHTML = '<span class="timestamp">' + timeStr + '</span>' + msg;
  contentEl.insertBefore(entry, contentEl.firstChild);
  mediaActivityCount++;
  if (badgeEl) badgeEl.innerText = mediaActivityCount + ' events';
}

function toggleMediaActivityLog() {
  var panel = document.getElementById('media-activity-log-panel');
  var arrow = document.getElementById('media-activity-log-arrow');
  if (!panel) return;
  var isHidden = panel.style.display === 'none';
  panel.style.display = isHidden ? 'block' : 'none';
  if (arrow) arrow.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
}

function clearMediaActivityLog() {
  var contentEl = document.getElementById('media-activity-log-content');
  var badgeEl = document.getElementById('media-activity-log-badge');
  if (contentEl) contentEl.innerHTML = '';
  mediaActivityCount = 0;
  if (badgeEl) badgeEl.innerText = '0 events';
  showToast('Diagnostics log cleared', 'success');
}

function mediaCheckbox(id, fallback) {
  var el = document.getElementById(id);
  if (!el) return fallback;
  return !!el.checked;
}

function getMediaScopeOptions() {
  var skipEl = document.getElementById('media-manual-skips');
  return {
    skipThumbs: mediaCheckbox('media-skip-thumbs', true),
    skipDsStore: mediaCheckbox('media-skip-ds-store', true),
    manualSkips: typeof parseManualSkips === 'function'
      ? parseManualSkips(skipEl ? skipEl.value : '')
      : [],
    manualSkipsCompiled: typeof compileManualSkips === 'function'
      ? compileManualSkips(typeof parseManualSkips === 'function' ? parseManualSkips(skipEl ? skipEl.value : '') : [])
      : null
  };
}

function getMediaProcessOptions() {
  var simEl = document.getElementById('media-similarity');
  var burstEl = document.getElementById('media-burst-keep');
  var frameEl = document.getElementById('media-frame-interval');
  var options = {
    similarity: simEl ? Number(simEl.value) : 92,
    collapseBursts: mediaCheckbox('media-collapse-bursts', true),
    maxBurstKeep: burstEl ? Number(burstEl.value) : 2,
    keepLargest: mediaCheckbox('media-keep-largest', true),
    allowResize: mediaCheckbox('media-allow-resize', true),
    frameIntervalMs: frameEl ? Number(frameEl.value) : 100,
    maxVideoFrames: 120
  };
  return attachMediaTargetToOptions(options);
}

function attachMediaTargetToOptions(options) {
  if (!mediaCheckbox('media-use-target', false) || !mediaTargetRef) return options;
  options.useTargetReference = true;
  options.targetPath = mediaTargetRef.path;
  options.targetBinary = mediaTargetRef.binaryData;
  if (mediaTargetRef.sig) options.targetSig = mediaTargetRef.sig;
  return options;
}

function updateMediaTargetUi() {
  var label = document.getElementById('media-target-label');
  var clearBtn = document.getElementById('media-target-clear');
  var libSelect = document.getElementById('media-target-from-library');

  if (label) {
    label.textContent = mediaTargetRef
      ? 'Target: ' + mediaTargetRef.path + (mediaTargetRef.external ? ' (external file)' : '')
      : 'No target selected';
  }
  if (clearBtn) clearBtn.style.display = mediaTargetRef ? 'inline-block' : 'none';

  if (libSelect) {
    var current = mediaTargetRef && !mediaTargetRef.external ? mediaTargetRef.path : '';
    libSelect.innerHTML = '<option value="">From loaded library...</option>';
    mediaProjectFiles.forEach(function(f) {
      if (!isMediaPath(f.path)) return;
      var opt = document.createElement('option');
      opt.value = f.path;
      opt.textContent = f.path;
      if (f.path === current) opt.selected = true;
      libSelect.appendChild(opt);
    });
    libSelect.disabled = !mediaProjectFiles.length;
    if (!current) libSelect.value = '';
  }
}

function onMediaTargetToggle() {
  updateMediaTargetUi();
  updateMediaDemo();
}

function openMediaTargetPicker() {
  var input = document.getElementById('media-target-input');
  if (!input) return;
  input.value = '';
  input.click();
}

async function handleMediaTargetPick(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  try {
    var data = await readMediaFileAsPromise(file);
    var rel = normalizePath(file.webkitRelativePath || file.name);
    if (!isMediaPath(rel)) {
      showToast('Pick an image or video file', 'warning');
      return;
    }
    mediaTargetRef = { path: rel, binaryData: data, external: true, sig: null };
    var useCb = document.getElementById('media-use-target');
    if (useCb) useCb.checked = true;
    updateMediaTargetUi();
    updateMediaDemo();
    showToast('Target set: ' + rel.split('/').pop(), 'success');
    logMediaActivity('Reference target: ' + rel);
  } catch (e) {
    showToast('Could not read target file', 'error');
  }
}

function setMediaTargetFromLibrary(path) {
  if (!path) return;
  var file = mediaProjectFiles.find(function(f) { return f.path === path; });
  if (!file) return;
  mediaTargetRef = { path: file.path, binaryData: file.binaryData, external: false, sig: null };
  var useCb = document.getElementById('media-use-target');
  if (useCb) useCb.checked = true;
  updateMediaTargetUi();
  updateMediaDemo();
  logMediaActivity('Reference target from library: ' + path);
}

function clearMediaTarget() {
  mediaTargetRef = null;
  var libSelect = document.getElementById('media-target-from-library');
  if (libSelect) libSelect.value = '';
  var useCb = document.getElementById('media-use-target');
  if (useCb) useCb.checked = false;
  updateMediaTargetUi();
  updateMediaDemo();
}

function getMediaDemoTargetOptions(options, analyzed) {
  if (!mediaCheckbox('media-use-target', false)) return options;
  var targetPath = mediaTargetRef ? mediaTargetRef.path : 'exports/vacation_final.jpg';
  var targetEntry = analyzed.find(function(e) { return e.path === targetPath; });
  if (!targetEntry) return options;
  return Object.assign({}, options, {
    useTargetReference: true,
    targetPath: targetPath,
    targetSig: targetEntry.sig,
    targetBinary: targetEntry.binaryData
  });
}

function setMediaProgress(phase, done, total, label) {
  var wrap = document.getElementById('media-progress-wrap');
  var bar = document.getElementById('media-progress-bar');
  var text = document.getElementById('media-progress-text');
  if (!wrap || !bar || !text) return;
  wrap.style.display = 'block';
  var pct = total > 0 ? Math.round((done / total) * 100) : 0;
  bar.style.width = pct + '%';
  text.textContent = phase + (total ? ' (' + done + ' / ' + total + ')' : '') + (label ? ': ' + label : '');
}

function hideMediaProgress() {
  var wrap = document.getElementById('media-progress-wrap');
  if (wrap) wrap.style.display = 'none';
}

function setMediaRunning(running) {
  var dedupeBtn = document.getElementById('media-btn-dedupe');
  var cancelBtn = document.getElementById('media-btn-cancel');
  if (dedupeBtn) dedupeBtn.disabled = running;
  if (cancelBtn) cancelBtn.style.display = running ? 'inline-block' : 'none';
}

function updateMediaManifest() {
  var el = document.getElementById('media-manifest');
  if (!el) return;
  if (mediaIsLoading) {
    el.value = 'Loading media files...';
    return;
  }
  el.value = mediaProjectFiles.length
    ? buildMediaManifest(mediaProjectFiles, mediaProjectName)
    : '';
}

function setMediaLoading(loading) {
  mediaIsLoading = loading;
  var el = document.getElementById('media-manifest');
  if (el) el.classList.toggle('drag-over', false);
  updateMediaManifest();
}

function addMediaFile(path, binaryData) {
  var norm = normalizePath(path);
  if (!isMediaPath(norm)) return;
  mediaProjectFiles.push({
    path: norm,
    binary: true,
    binaryData: binaryData,
    content: null
  });
}

function estimateMediaBytes(fileList) {
  var total = 0;
  for (var i = 0; i < fileList.length; i++) total += fileList[i].size || 0;
  return total;
}

function validateMediaLoad(fileList) {
  if (fileList.length > MEDIA_MAX_FILES) {
    return 'Too many files (' + fileList.length + '). Limit is ' + MEDIA_MAX_FILES + '.';
  }
  var bytes = estimateMediaBytes(fileList);
  if (bytes > MEDIA_MAX_BYTES) {
    return 'Library too large (' + (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB). Try a smaller folder.';
  }
  return null;
}

function warnMediaLoad(fileList) {
  var bytes = estimateMediaBytes(fileList);
  if (fileList.length > MEDIA_WARN_FILES) {
    showToast('Large library: ' + fileList.length + ' files. This may take a while.', 'warning');
    logMediaActivity('Warning: ' + fileList.length + ' files loaded');
  } else if (bytes > MEDIA_WARN_BYTES) {
    showToast('Large library: ' + (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB in memory.', 'warning');
    logMediaActivity('Warning: ' + (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB loaded');
  }
}

function loadMediaFilesBatched(files) {
  var index = 0;
  function nextBatch() {
    var batch = files.slice(index, index + MEDIA_LOAD_BATCH);
    index += MEDIA_LOAD_BATCH;
    if (!batch.length) return Promise.resolve();
    return Promise.all(batch.map(function(file) {
      var rel = normalizePath(file.webkitRelativePath || file.name);
      return readMediaFileAsPromise(file).then(function(data) {
        addMediaFile(rel, data);
      });
    })).then(nextBatch);
  }
  return nextBatch();
}

function readMediaFileAsPromise(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function(e) { resolve(e.target.result); };
    reader.onerror = function() { reject(new Error('Could not read ' + (file.name || 'file'))); };
    reader.readAsArrayBuffer(file);
  });
}

function filterMediaFiles(fileList) {
  var scope = getMediaScopeOptions();
  return Array.from(fileList).filter(function(file) {
    var rel = normalizePath(file.webkitRelativePath || file.name);
    if (shouldIgnoreMediaPath(rel, scope)) return false;
    return isMediaPath(rel);
  });
}

function finishMediaLoad(sourceLabel) {
  setMediaLoading(false);
  mediaProjectFiles.sort(function(a, b) { return naturalPathCompare(a.path, b.path); });
  updateMediaManifest();
  if (!mediaProjectFiles.length) {
    showToast('No image or video files found', 'warning');
    return;
  }
  logMediaActivity('Loaded ' + mediaProjectFiles.length + ' media files from ' + sourceLabel);
  showToast('Loaded ' + mediaProjectFiles.length + ' media files', 'success');
  updateMediaTargetUi();
}

function loadMediaFromFileList(fileList) {
  var files = filterMediaFiles(fileList);
  if (!files.length) {
    showToast('No image or video files found', 'warning');
    return;
  }

  var limitErr = validateMediaLoad(files);
  if (limitErr) {
    showToast(limitErr, 'error');
    return;
  }
  warnMediaLoad(files);

  mediaProjectFiles = [];
  mediaProjectName = (files[0].webkitRelativePath || files[0].name).split('/')[0] || 'media';
  setMediaLoading(true);

  loadMediaFilesBatched(files).then(function() {
    finishMediaLoad('folder');
  }).catch(function(err) {
    setMediaLoading(false);
    showToast(err.message, 'error');
  });
}

function loadMediaFromZip(file) {
  var start = function () {
    if (typeof JSZip === 'undefined') {
      showToast('JSZip not loaded', 'error');
      return;
    }

    mediaProjectFiles = [];
    mediaProjectName = file.name.replace(/\.zip$/i, '') || 'media';
    setMediaLoading(true);

    readMediaFileAsPromise(file).then(function(buf) {
      return JSZip.loadAsync(buf);
    }).then(function(zip) {
    var scope = getMediaScopeOptions();
    var names = Object.keys(zip.files).filter(function(n) {
      if (zip.files[n].dir) return false;
      var norm = normalizePath(n);
      if (shouldIgnoreMediaPath(norm, scope)) return false;
      return isMediaPath(norm);
    });
    if (!names.length) throw new Error('Zip has no image or video files');
    if (names.length > MEDIA_MAX_FILES) throw new Error('Too many files in zip (' + names.length + '). Limit is ' + MEDIA_MAX_FILES + '.');

    var index = 0;
    function nextZipBatch() {
      var batch = names.slice(index, index + MEDIA_LOAD_BATCH);
      index += MEDIA_LOAD_BATCH;
      if (!batch.length) return Promise.resolve();
      return Promise.all(batch.map(function(name) {
        var norm = normalizePath(name);
        return zip.files[name].async('arraybuffer').then(function(data) {
          addMediaFile(norm, data);
        });
      })).then(nextZipBatch);
    }
    return nextZipBatch();
  }).then(function() {
    finishMediaLoad('zip');
  }).catch(function(err) {
    setMediaLoading(false);
    showToast(err.message, 'error');
  });
  };

  if (typeof ensureLib === 'function') {
    ensureLib('jszip').then(start).catch(function (e) {
      showToast('Failed to load zip library: ' + e.message, 'error');
    });
  } else {
    start();
  }
}

function collectMediaEntriesFromDirectory(entry, base) {
  var scope = getMediaScopeOptions();
  return new Promise(function(resolve) {
    var results = [];
    if (!entry.isDirectory) {
      resolve(results);
      return;
    }
    var reader = entry.createReader();
    function readBatch() {
      reader.readEntries(function(entries) {
        if (!entries.length) {
          resolve(results);
          return;
        }
        var chain = Promise.resolve();
        entries.forEach(function(ent) {
          chain = chain.then(function() {
            var path = base ? base + '/' + ent.name : ent.name;
            if (ent.isFile) {
              return new Promise(function(res) {
                ent.file(function(file) {
                  try {
                    Object.defineProperty(file, 'webkitRelativePath', { value: path, configurable: true });
                  } catch (e) { /* ignore */ }
                  results.push(file);
                  res();
                });
              });
            }
            if (ent.isDirectory) {
              var dirPath = base ? base + '/' + ent.name : ent.name;
              if (shouldIgnoreMediaPath(dirPath + '/', scope)) return Promise.resolve();
              return collectMediaEntriesFromDirectory(ent, dirPath).then(function(sub) {
                results = results.concat(sub);
              });
            }
            return Promise.resolve();
          });
        });
        chain.then(readBatch);
      });
    }
    readBatch();
  });
}

function handleMediaDrop(dt) {
  if (mediaIsLoading) return;

  var items = dt.items;
  if (items && items.length && items[0].webkitGetAsEntry) {
    var entry = items[0].webkitGetAsEntry();
    if (entry && entry.isDirectory) {
      setMediaLoading(true);
      collectMediaEntriesFromDirectory(entry, entry.name).then(function(files) {
        if (files.length) loadMediaFromFileList(files);
        else {
          setMediaLoading(false);
          showToast('No media files found in folder', 'warning');
        }
      });
      return;
    }
  }

  var files = dt.files;
  if (!files || !files.length) return;
  if (files.length === 1 && /\.zip$/i.test(files[0].name)) {
    loadMediaFromZip(files[0]);
    return;
  }
  loadMediaFromFileList(files);
}

function handleMediaPick(input) {
  if (!input.files || !input.files.length) return;
  if (input.files.length === 1 && /\.zip$/i.test(input.files[0].name)) {
    loadMediaFromZip(input.files[0]);
  } else {
    loadMediaFromFileList(input.files);
  }
  input.value = '';
}

function resetMediaUploadInput(input) {
  input.removeAttribute('webkitdirectory');
  input.removeAttribute('directory');
  input.setAttribute('accept', '.zip,application/zip');
}

function handleMediaUpload(input) {
  handleMediaPick(input);
  resetMediaUploadInput(input);
}

async function walkMediaDirectoryHandle(dirHandle, base) {
  var results = [];
  for await (var entry of dirHandle.values()) {
    var path = base ? base + '/' + entry.name : entry.name;
    if (entry.kind === 'file') {
      var file = await entry.getFile();
      try {
        Object.defineProperty(file, 'webkitRelativePath', { value: path, configurable: true });
      } catch (e) { /* ignore */ }
      results.push(file);
    } else if (entry.kind === 'directory') {
      var scope = getMediaScopeOptions();
      if (shouldIgnoreMediaPath(path + '/', scope)) continue;
      var sub = await walkMediaDirectoryHandle(entry, path);
      results = results.concat(sub);
    }
  }
  return results;
}

function loadFromMediaDirectoryHandle(dirHandle) {
  mediaProjectFiles = [];
  mediaProjectName = dirHandle.name || 'media';
  setMediaLoading(true);
  walkMediaDirectoryHandle(dirHandle, '').then(function(files) {
    if (!files.length) {
      setMediaLoading(false);
      showToast('No media files found', 'warning');
      return;
    }
    loadMediaFromFileList(files);
  }).catch(function(err) {
    setMediaLoading(false);
    showToast(err.message, 'error');
  });
}

function openMediaZipFilePicker() {
  var input = document.getElementById('media-upload-input');
  if (!input) return;
  input.value = '';
  input.removeAttribute('webkitdirectory');
  input.removeAttribute('directory');
  input.setAttribute('accept', '.zip,application/zip');
  input.onchange = function() { handleMediaUpload(input); };
  input.click();
}

function pickMediaFolderOrZipInput() {
  var input = document.getElementById('media-upload-input');
  if (!input) return;
  input.value = '';
  if ('webkitdirectory' in HTMLInputElement.prototype) {
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.removeAttribute('accept');
  } else {
    input.removeAttribute('webkitdirectory');
    input.removeAttribute('directory');
    input.setAttribute('accept', '.zip,application/zip');
  }
  input.onchange = function() { handleMediaUpload(input); };
  input.click();
}

function openMediaUpload() {
  if (window.showDirectoryPicker) {
    window.showDirectoryPicker().then(loadFromMediaDirectoryHandle).catch(function(err) {
      if (err.name === 'AbortError') openMediaZipFilePicker();
      else showToast(err.message, 'error');
    });
    return;
  }
  pickMediaFolderOrZipInput();
}

function updateMediaSimValue() {
  var simRange = document.getElementById('media-similarity');
  var valEl = document.getElementById('media-sim-val');
  if (!simRange || !valEl) return;
  var v = Number(simRange.value);
  if (v >= 100) valEl.innerText = '100% (identical bytes)';
  else if (v >= 97) valEl.innerText = v + '% (near-identical)';
  else valEl.innerText = v + '% match';
}

var mediaSkipInputTimer = null;
function onMediaSkipInput() {
  if (mediaSkipInputTimer) clearTimeout(mediaSkipInputTimer);
  mediaSkipInputTimer = setTimeout(updateMediaDemo, 300);
}

function getMediaDemoSignaturesRaw() {
  var burstHash = bitsToHex('1111000011110000111100001111000011110000111100001111000011110000');
  var vacationHash = bitsToHex('1010101010101010101010101010101010101010101010101010101010101010');
  var clipHash = bitsToHex('1100110011001100110011001100110011001100110011001100110011001100');

  function img(path, hash, exact, w, h) {
    return {
      path: path,
      binaryData: new ArrayBuffer(8),
      sig: {
        kind: 'image',
        dHash: hash,
        aHash: hash,
        blockHash: hash,
        scales: [hash],
        exactHash: exact,
        width: w || 1920,
        height: h || 1080,
        byteSize: w * h
      }
    };
  }

  function vid(path, hash, exact) {
    var warmHue = [0.55, 0.2, 0.05, 0.02, 0.03, 0.04, 0.03, 0.02, 0.02, 0.02, 0.01, 0.01];
    var frame = {
      dHash: hash,
      colorHash: hash,
      detailHash: hash,
      hueHist: warmHue,
      luma: 0.42,
      contrast: 0.18,
      saturation: 0.35,
      t: 0
    };
    return {
      path: path,
      binaryData: new ArrayBuffer(8),
      sig: {
        kind: 'video',
        dHash: hash,
        frameHashes: [hash],
        uniqueFrameHashes: [hash],
        frameProfiles: [frame],
        uniqueFrameProfiles: [frame],
        aggregateHue: warmHue,
        meanLuma: 0.42,
        meanContrast: 0.18,
        meanSaturation: 0.35,
        duration: 5,
        width: 1920,
        height: 1080,
        exactHash: exact,
        byteSize: 5000000
      }
    };
  }

  return [
    img('camera-roll/IMG_0001.jpg', burstHash, 'b1', 4000, 3000),
    img('camera-roll/IMG_0002.jpg', burstHash, 'b2', 4000, 3000),
    img('camera-roll/IMG_0003.jpg', burstHash, 'b3', 4000, 3000),
    img('exports/vacation_copy.jpg', vacationHash, 'v1', 2400, 1600),
    img('exports/vacation_final.jpg', vacationHash, 'v2', 2400, 1600),
    vid('clip_A.mp4', clipHash, 'c1'),
    vid('clip_A_renamed.mp4', clipHash, 'c2')
  ];
}

function getMediaDemoSignatures() {
  var scope = getMediaScopeOptions();
  return getMediaDemoSignaturesRaw().filter(function(entry) {
    if (scope.manualSkipsCompiled && matchesManualSkip(entry.path, scope.manualSkipsCompiled)) return false;
    if (shouldIgnoreMediaPath(entry.path, scope)) return false;
    return true;
  });
}

function splitMediaDemoForRun(entries) {
  var scope = getMediaScopeOptions();
  var analyzed = [];
  var passthrough = [];
  entries.forEach(function(entry) {
    if (scope.manualSkipsCompiled && matchesManualSkip(entry.path, scope.manualSkipsCompiled)) {
      passthrough.push({
        path: entry.path,
        binaryData: entry.binaryData,
        passthrough: true,
        skip: true
      });
    } else {
      analyzed.push(entry);
    }
  });
  return { analyzed: analyzed, passthrough: passthrough };
}

function updateMediaDemo() {
  var outputEl = document.getElementById('media-example-output');
  var statusEl = document.getElementById('media-example-status');
  if (!outputEl || typeof processMediaAnalysisResults !== 'function') return;

  try {
    var options = getMediaProcessOptions();
    var split = splitMediaDemoForRun(getMediaDemoSignaturesRaw());
    var analyzed = split.analyzed;
    options = getMediaDemoTargetOptions(options, analyzed);
    var result = processMediaAnalysisResults(split.passthrough, analyzed, options);
    var s = result.stats;

    if (statusEl) {
      statusEl.textContent = 'Files: ' + (analyzed.length + split.passthrough.length) +
        ' | Removed: ' + s.filesRemoved +
        (s.targetMode ? ' | Target mode' : ' | Groups: ' + s.variationClusters) +
        (s.burstClusters ? ' | Bursts: ' + s.burstClusters : '') +
        (s.passthroughFiles ? ' | Unchanged: ' + s.passthroughFiles : '') +
        ' | Kept: ' + s.keptFiles;
    }

    var lines = [];
    if (result.clusters && result.clusters.length) {
      result.clusters.forEach(function(group, i) {
        lines.push('Group ' + (i + 1) + ' kept ' + group.kept);
        group.removed.forEach(function(p) { lines.push('  removed ' + p); });
      });
    }
    var burstLines = result.report.filter(function(r) { return r.indexOf('Burst duplicate') === 0; });
    burstLines.forEach(function(r) { lines.push(r.replace('Burst duplicate removed: ', 'burst ')); });

    outputEl.value = lines.length
      ? lines.join('\n')
      : 'No visual duplicates at this threshold.';
    if (typeof window.refreshDemoPreview === 'function') window.refreshDemoPreview();
  } catch (e) {
    if (statusEl) statusEl.textContent = '';
    outputEl.value = 'Demo unavailable';
  }
}

function cancelMediaRun() {
  mediaRunToken++;
  setMediaRunning(false);
  hideMediaProgress();
  var status = document.getElementById('media-status-text');
  if (status) status.textContent = 'Cancelled';
  showToast('Cancelled', 'warning');
  logMediaActivity('Run cancelled by user');
}

async function analyzeAllMediaFiles(files, options, runToken, onProgress) {
  var analyzed = [];
  var passthrough = [];
  var scope = getMediaScopeOptions();
  var queue = [];

  files.forEach(function(f) {
    var path = normalizePath(f.path);
    if (!isMediaPath(path)) {
      passthrough.push({ path: path, binary: true, binaryData: f.binaryData, passthrough: true });
      return;
    }
    if (shouldIgnoreMediaPath(path, scope)) return;
    if (scope.manualSkipsCompiled && matchesManualSkip(path, scope.manualSkipsCompiled)) {
      passthrough.push({ path: path, binary: true, binaryData: f.binaryData, passthrough: true, skip: true });
      return;
    }
    queue.push(f);
  });

  var total = queue.length;
  var done = 0;
  var idx = 0;

  async function worker() {
    while (idx < queue.length) {
      if (runToken !== mediaRunToken) throw new Error('Cancelled');
      var i = idx++;
      var f = queue[i];
      var path = normalizePath(f.path);
      if (onProgress) onProgress(done, total, path);
      logMediaActivity('Analyzing: ' + path);
      var sig = await analyzeMediaFile(f, options);
      analyzed.push({ path: path, binaryData: f.binaryData, sig: sig });
      done++;
      if (onProgress) onProgress(done, total, path);
      await new Promise(function(r) { setTimeout(r, 0); });
    }
  }

  var workers = [];
  var n = Math.min(MEDIA_ANALYSIS_CONCURRENCY, Math.max(1, queue.length));
  for (var w = 0; w < n; w++) workers.push(worker());
  await Promise.all(workers);

  return { analyzed: analyzed, passthrough: passthrough };
}

async function deduplicateMedia() {
  if (!mediaProjectFiles.length) {
    showToast('Load a folder or zip first', 'warning');
    return;
  }

  var container = document.getElementById('media-output-container');
  var output = document.getElementById('media-output');
  var status = document.getElementById('media-status-text');
  var options = getMediaProcessOptions();
  var runToken = ++mediaRunToken;

  if (mediaCheckbox('media-use-target', false) && !mediaTargetRef) {
    showToast('Pick a reference target file or turn off target mode', 'warning');
    return;
  }

  if (container) {
    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth' });
  }
  setMediaRunning(true);
  setMediaProgress('Analyzing', 0, mediaProjectFiles.length, '');
  if (status) status.textContent = 'Preparing ' + mediaProjectFiles.length + ' files...';

  logMediaActivity('Starting variation dedupe on ' + mediaProjectFiles.length + ' files at ' + options.similarity + '%' +
    (options.useTargetReference ? ' (target: ' + options.targetPath + ')' : ''));

  var scope = getMediaScopeOptions();
  var checkpointId = typeof createCheckpoint === 'function' && typeof cloneMediaFiles === 'function'
    ? createCheckpoint('media-pre-dedup', {
      type: 'media',
      files: cloneMediaFiles(mediaProjectFiles),
      projectName: mediaProjectName
    })
    : null;

  try {
    var start = performance.now();
    var snapshot = mediaProjectFiles.map(function(f) {
      return { path: f.path, binaryData: f.binaryData };
    });

    var analysis = await analyzeAllMediaFiles(snapshot, options, runToken, function(done, total, path) {
      setMediaProgress('Analyzing', done, total, path.split('/').pop());
      if (status) status.textContent = 'Analyzing ' + done + ' / ' + total;
    });

    if (runToken !== mediaRunToken) return;

    if (options.useTargetReference && mediaTargetRef) {
      var targetNorm = normalizePath(mediaTargetRef.path);
      var fromAnalysis = analysis.analyzed.find(function(e) {
        return normalizePath(e.path) === targetNorm;
      });
      if (fromAnalysis && fromAnalysis.sig && !fromAnalysis.sig.error) {
        mediaTargetRef.sig = fromAnalysis.sig;
        options.targetSig = fromAnalysis.sig;
      } else if (!mediaTargetRef.sig) {
        setMediaProgress('Analyzing target', 0, 1, mediaTargetRef.path);
        if (status) status.textContent = 'Analyzing reference target...';
        var targetSig = await analyzeMediaFile({
          path: mediaTargetRef.path,
          binaryData: mediaTargetRef.binaryData
        }, options);
        if (runToken !== mediaRunToken) return;
        mediaTargetRef.sig = targetSig;
        options.targetSig = targetSig;
      } else {
        options.targetSig = mediaTargetRef.sig;
      }
      options.targetPath = mediaTargetRef.path;
      options.targetBinary = mediaTargetRef.binaryData;
      options.useTargetReference = true;
    }

    if (!analysis.analyzed.length && !analysis.passthrough.length) {
      showToast('No analyzable media files', 'warning');
      if (status) status.textContent = 'No media to analyze';
      hideMediaProgress();
      setMediaRunning(false);
      return;
    }

    setMediaProgress(
      options.useTargetReference ? 'Matching to target' : 'Clustering',
      analysis.analyzed.length,
      Math.max(analysis.analyzed.length, 1),
      ''
    );
    if (status) {
      status.textContent = options.useTargetReference
        ? 'Matching files against ' + options.targetPath.split('/').pop() + '...'
        : (analysis.analyzed.length
          ? 'Clustering ' + analysis.analyzed.length + ' signatures...'
          : 'Packaging ' + analysis.passthrough.length + ' unchanged file(s)...');
    }
    await new Promise(function(r) { setTimeout(r, 0); });

    var result = processMediaAnalysisResults(analysis.passthrough, analysis.analyzed, options);
    var verification = typeof verifyMediaResult === 'function'
      ? verifyMediaResult(snapshot, result, options)
      : { passed: true, summary: 'ok' };
    var elapsed = Math.round(performance.now() - start);
    mediaProcessedResult = result;
    var s = result.stats;

    if (checkpointId && typeof registerMediaPipelineRun === 'function') {
      registerMediaPipelineRun({
        type: 'media',
        checkpointId: checkpointId,
        result: result,
        verification: verification,
        canRevert: true
      });
    }

    if (output) output.value = buildMediaReportText(result, elapsed);
    if (status) {
      status.textContent = 'Media: ' + (s.totalMedia + (s.passthroughFiles || 0)) +
        ' | Removed: ' + s.filesRemoved +
        (s.targetMode ? ' | Target: ' + (s.targetPath || '').split('/').pop() : ' | Groups: ' + s.variationClusters) +
        (s.burstClusters ? ' | Bursts: ' + s.burstClusters : '') +
        (s.passthroughFiles ? ' | Unchanged: ' + s.passthroughFiles : '') +
        ' | Kept: ' + s.keptFiles +
        ' (' + elapsed + 'ms)';
    }
    var toastMsg = s.filesRemoved
      ? (s.targetMode
        ? 'Removed ' + s.filesRemoved + ' variation(s) of your target'
        : 'Removed ' + s.filesRemoved + ' variation duplicate(s)')
      : (s.passthroughFiles && !s.totalMedia ? 'All files left unchanged' : 'No duplicates found');
    showToast(toastMsg, 'success');
    logMediaActivity('Done in ' + elapsed + 'ms. Removed ' + s.filesRemoved + ' duplicate(s). ' + verification.summary);
    if (typeof updateMediaPreviewButton === 'function') updateMediaPreviewButton();
  } catch (e) {
    if (e.message === 'Cancelled') return;
    console.error(e);
    showToast('Error: ' + e.message, 'error');
    if (status) status.textContent = 'Error: ' + e.message;
    logMediaActivity('ERROR: ' + e.message);
  } finally {
    if (runToken === mediaRunToken) {
      hideMediaProgress();
      setMediaRunning(false);
    }
  }
}

function revertMediaProject() {
  if (typeof revertLastPipelineRun !== 'function') return false;
  var restored = revertLastPipelineRun();
  if (!restored || restored.type !== 'media' || !restored.files) return false;
  mediaProjectFiles = restored.files.map(function(f) {
    return {
      path: f.path,
      binary: true,
      binaryData: f.binaryData,
      content: null
    };
  });
  mediaProcessedResult = null;
  mediaProjectName = restored.projectName || mediaProjectName;
  updateMediaManifest();
  var output = document.getElementById('media-output');
  var status = document.getElementById('media-status-text');
  var container = document.getElementById('media-output-container');
  if (output) output.value = '';
  if (status) status.textContent = '';
  if (container) container.style.display = 'none';
  if (typeof updateMediaPreviewButton === 'function') updateMediaPreviewButton();
  showToast('Reverted media library to pre-dedup state', 'success');
  logMediaActivity('Reverted media library to checkpoint');
  return true;
}

function clearMediaProject() {
  mediaRunToken++;
  mediaProjectFiles = [];
  mediaProcessedResult = null;
  mediaProjectName = '';
  mediaTargetRef = null;
  setMediaLoading(false);
  setMediaRunning(false);
  hideMediaProgress();
  updateMediaManifest();

  var output = document.getElementById('media-output');
  var status = document.getElementById('media-status-text');
  var container = document.getElementById('media-output-container');
  if (output) output.value = '';
  if (status) status.textContent = '';
  if (container) container.style.display = 'none';
  if (typeof updateMediaPreviewButton === 'function') updateMediaPreviewButton();
  var useCb = document.getElementById('media-use-target');
  if (useCb) useCb.checked = false;
  updateMediaTargetUi();
  showToast('Workspace cleared', 'success');
  logMediaActivity('Workspace cleared');
}

function copyMediaOutput() {
  var output = document.getElementById('media-output');
  if (!output || !output.value.trim()) return;
  var text = output.value;
  function onCopied() {
    var btn = document.getElementById('media-btn-copy');
    if (btn) {
      var orig = btn.innerText;
      btn.innerText = 'Copied!';
      setTimeout(function() { btn.innerText = orig; }, 2000);
    }
    showToast('Copied to clipboard!', 'success');
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(onCopied).catch(function() {
      output.select();
      document.execCommand('copy');
      onCopied();
    });
    return;
  }
  output.select();
  document.execCommand('copy');
  onCopied();
}

function downloadMediaZip() {
  var files = mediaProcessedResult && mediaProcessedResult.files;
  if (!files || !files.length) {
    showToast('Run deduplication first', 'warning');
    return;
  }

  var build = function () {
    if (typeof JSZip === 'undefined') {
      showToast('JSZip not loaded', 'error');
      return;
    }

    var zip = new JSZip();
  files.forEach(function(f) {
    if (f.binaryData) zip.file(f.path, f.binaryData);
  });

  var btn = document.getElementById('media-btn-download');
  if (btn) btn.disabled = true;

  zip.generateAsync({ type: 'blob' }).then(function(blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (mediaProjectName || 'deduplicated-media') + '.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (btn) {
      btn.disabled = false;
      var orig = btn.innerText;
      btn.innerText = 'Downloaded!';
      setTimeout(function() { btn.innerText = orig; }, 2000);
    }
    showToast('Downloaded ' + a.download, 'success');
    logMediaActivity('Downloaded zip (' + files.length + ' files)');
  }).catch(function(err) {
    if (btn) btn.disabled = false;
    showToast('Zip failed: ' + err.message, 'error');
  });
  };

  if (typeof ensureLib === 'function') {
    ensureLib('jszip').then(build).catch(function (e) {
      showToast('Failed to load zip library: ' + e.message, 'error');
    });
  } else {
    build();
  }
}

function initMediaTab() {
  var manifest = document.getElementById('media-manifest');
  if (manifest) {
    ['dragenter', 'dragover'].forEach(function(ev) {
      manifest.addEventListener(ev, function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!mediaIsLoading) manifest.classList.add('drag-over');
      });
    });
    ['dragleave', 'drop'].forEach(function(ev) {
      manifest.addEventListener(ev, function(e) {
        e.preventDefault();
        e.stopPropagation();
        manifest.classList.remove('drag-over');
      });
    });
    manifest.addEventListener('drop', function(e) {
      handleMediaDrop(e.dataTransfer);
    });
  }
  updateMediaManifest();
}

function bootMediaApp() {
  initMediaTab();
  updateMediaSimValue();
  updateMediaTargetUi();
  updateMediaDemo();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootMediaApp);
} else {
  bootMediaApp();
}
