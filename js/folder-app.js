// Geckodupe Folder / Zip tab

var folderProjectFiles = [];
var folderProcessedResult = null;
var folderActivityCount = 0;
var folderProjectName = '';
var folderIsLoading = false;

var FOLDER_MODE_LABELS = {
  safe: 'Safe',
  data: 'Data files only',
  report: 'Report only',
  aggressive: 'Aggressive'
};

function logFolderActivity(msg) {
  var contentEl = document.getElementById('folder-activity-log-content');
  var badgeEl = document.getElementById('folder-activity-log-badge');
  if (!contentEl) return;
  var now = new Date();
  var timeStr = '[' + now.toTimeString().split(' ')[0] + '.' + ('00' + now.getMilliseconds()).slice(-3) + ']';
  var entry = document.createElement('div');
  entry.className = 'activity-entry';
  entry.innerHTML = '<span class="timestamp">' + timeStr + '</span>' + msg;
  contentEl.insertBefore(entry, contentEl.firstChild);
  folderActivityCount++;
  if (badgeEl) badgeEl.innerText = folderActivityCount + ' events';
}

function toggleFolderActivityLog() {
  var panel = document.getElementById('folder-activity-log-panel');
  var arrow = document.getElementById('folder-activity-log-arrow');
  if (!panel) return;
  var isHidden = panel.style.display === 'none';
  panel.style.display = isHidden ? 'block' : 'none';
  if (arrow) arrow.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
}

function clearFolderActivityLog() {
  var contentEl = document.getElementById('folder-activity-log-content');
  var badgeEl = document.getElementById('folder-activity-log-badge');
  if (contentEl) contentEl.innerHTML = '';
  folderActivityCount = 0;
  if (badgeEl) badgeEl.innerText = '0 events';
  showToast('Diagnostics log cleared', 'success');
}

function scopeFromMode(mode) {
  var base = {
    preserveEntryPoints: true,
    canonicalStrategy: 'shortest',
    reportOnly: false
  };
  if (mode === 'data') {
    return Object.assign(base, {
      dedupFiles: false, dedupWithinFiles: true, dedupWithinCode: false,
      crossFileLines: true, detectCodeBlocks: false, removeCodeBlocks: false
    });
  }
  if (mode === 'report') {
    return Object.assign(base, {
      dedupFiles: false, dedupWithinFiles: false, dedupWithinCode: false,
      crossFileLines: false, detectCodeBlocks: true, removeCodeBlocks: false,
      reportOnly: true
    });
  }
  if (mode === 'aggressive') {
    return Object.assign(base, {
      dedupFiles: true, dedupWithinFiles: true, dedupWithinCode: true,
      crossFileLines: true, detectCodeBlocks: true, removeCodeBlocks: true
    });
  }
  return Object.assign(base, {
    dedupFiles: true, dedupWithinFiles: true, dedupWithinCode: false,
    crossFileLines: true, detectCodeBlocks: true, removeCodeBlocks: false
  });
}

function folderCheckbox(id, fallback) {
  var el = document.getElementById(id);
  if (!el) return fallback;
  return !!el.checked;
}

function getFolderScopeOptions() {
  var modeEl = document.getElementById('folder-mode');
  var scope = scopeFromMode(modeEl ? modeEl.value : 'safe');
  scope.ignoreNodeModules = folderCheckbox('folder-skip-node-modules', true);
  scope.ignoreGit = folderCheckbox('folder-skip-git', true);
  scope.ignoreDist = folderCheckbox('folder-skip-dist', true);
  scope.ignoreVendor = folderCheckbox('folder-skip-vendor', true);
  var skipEl = document.getElementById('folder-manual-skips');
  scope.manualSkips = typeof parseManualSkips === 'function'
    ? parseManualSkips(skipEl ? skipEl.value : '')
    : [];
  scope.manualSkipsCompiled = typeof compileManualSkips === 'function'
    ? compileManualSkips(scope.manualSkips)
    : null;
  return scope;
}

var folderSkipInputTimer = null;
function onFolderSkipOptionsChange() {
  updateFolderDemo();
}

function onFolderSkipInput() {
  if (folderSkipInputTimer) clearTimeout(folderSkipInputTimer);
  folderSkipInputTimer = setTimeout(updateFolderDemo, 300);
}

function updateFolderManifest() {
  var el = document.getElementById('folder-manifest');
  if (!el) return;
  if (folderIsLoading) {
    el.value = 'Loading project files...';
    return;
  }
  el.value = folderProjectFiles.length
    ? buildFolderManifest(folderProjectFiles, folderProjectName)
    : '';
}

function setFolderLoading(loading) {
  folderIsLoading = loading;
  var el = document.getElementById('folder-manifest');
  if (el) el.classList.toggle('drag-over', false);
  updateFolderManifest();
}

function addFolderFile(path, content, binary, binaryData) {
  var norm = normalizePath(path);
  if (isSkippedExtension(norm)) return;
  if (typeof isBinaryPath === 'function' && isBinaryPath(norm) && !norm.toLowerCase().match(/\.xlsx?$/)) return;
  folderProjectFiles.push({
    path: norm,
    content: binary ? null : (content || ''),
    binary: !!binary,
    binaryData: binaryData || null,
    format: detectFormatFromPath(norm)
  });
}

function readFileAsPromise(file, asBinary) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function(e) { resolve(e.target.result); };
    reader.onerror = function() { reject(new Error('Could not read ' + (file.name || 'file'))); };
    if (asBinary) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  });
}

function filterLoadableFiles(fileList) {
  var scope = getFolderScopeOptions();
  return Array.from(fileList).filter(function(file) {
    var rel = normalizePath(file.webkitRelativePath || file.name);
    if (shouldIgnorePath(rel, scope)) return false;
    if (isSkippedExtension(rel)) return false;
    if (rel.toLowerCase().match(/\.xlsx?$/)) return true;
    return !rel.match(/\.(png|jpg|gif|pdf|exe|dll|zip|woff2?)$/i);
  });
}

function finishFolderLoad(sourceLabel) {
  setFolderLoading(false);
  folderProjectFiles.sort(function(a, b) { return a.path.localeCompare(b.path); });
  updateFolderManifest();
  if (!folderProjectFiles.length) {
    showToast('No supported files found', 'warning');
    return;
  }
  logFolderActivity('Loaded ' + folderProjectFiles.length + ' files from ' + sourceLabel);
  showToast('Loaded ' + folderProjectFiles.length + ' files', 'success');
}

function loadFolderFromFileList(fileList) {
  var files = filterLoadableFiles(fileList);
  if (!files.length) {
    showToast('No supported files found', 'warning');
    return;
  }

  folderProjectFiles = [];
  folderProjectName = (files[0].webkitRelativePath || files[0].name).split('/')[0] || 'project';
  setFolderLoading(true);

  var chain = Promise.resolve();
  files.forEach(function(file) {
    chain = chain.then(function() {
      var rel = normalizePath(file.webkitRelativePath || file.name);
      var isXlsx = /\.xlsx?$/i.test(rel);
      return readFileAsPromise(file, isXlsx).then(function(data) {
        addFolderFile(rel, isXlsx ? null : data, isXlsx, isXlsx ? data : null);
      });
    });
  });

  chain.then(function() { finishFolderLoad('folder'); }).catch(function(err) {
    setFolderLoading(false);
    showToast(err.message, 'error');
  });
}

function loadFolderFromZip(file) {
  var start = function () {
    if (typeof JSZip === 'undefined') {
      showToast('JSZip not loaded', 'error');
      return;
    }

    folderProjectFiles = [];
    folderProjectName = file.name.replace(/\.zip$/i, '') || 'archive';
    setFolderLoading(true);

    readFileAsPromise(file, true).then(function(buf) {
      return JSZip.loadAsync(buf);
    }).then(function(zip) {
    var scope = getFolderScopeOptions();
    var names = Object.keys(zip.files).filter(function(n) {
      return !zip.files[n].dir && !shouldIgnorePath(n, scope) && !isSkippedExtension(n);
    });
    if (!names.length) throw new Error('Zip has no supported files');

    var chain = Promise.resolve();
    names.forEach(function(name) {
      chain = chain.then(function() {
        var norm = normalizePath(name);
        var isXlsx = /\.xlsx?$/i.test(norm);
        var method = isXlsx ? 'arraybuffer' : 'string';
        return zip.files[name].async(method).then(function(data) {
          addFolderFile(norm, isXlsx ? null : data, isXlsx, isXlsx ? data : null);
        });
      });
    });
    return chain;
  }).then(function() {
    finishFolderLoad('zip');
  }).catch(function(err) {
    setFolderLoading(false);
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

function collectEntriesFromDirectory(entry, base) {
  var scope = getFolderScopeOptions();
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
              if (shouldIgnorePath(dirPath + '/', scope)) return Promise.resolve();
              return collectEntriesFromDirectory(ent, dirPath).then(function(sub) {
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

function handleFolderDrop(dt) {
  if (folderIsLoading) return;

  var items = dt.items;
  if (items && items.length && items[0].webkitGetAsEntry) {
    var entry = items[0].webkitGetAsEntry();
    if (entry && entry.isDirectory) {
      setFolderLoading(true);
      collectEntriesFromDirectory(entry, entry.name).then(function(files) {
        if (files.length) loadFolderFromFileList(files);
        else {
          setFolderLoading(false);
          showToast('No files found in folder', 'warning');
        }
      });
      return;
    }
  }

  var files = dt.files;
  if (!files || !files.length) return;
  if (files.length === 1 && /\.zip$/i.test(files[0].name)) {
    loadFolderFromZip(files[0]);
    return;
  }
  loadFolderFromFileList(files);
}

function handleFolderPick(input) {
  if (!input.files || !input.files.length) return;
  if (input.files.length === 1 && /\.zip$/i.test(input.files[0].name)) {
    loadFolderFromZip(input.files[0]);
  } else {
    loadFolderFromFileList(input.files);
  }
  input.value = '';
}

function resetFolderUploadInput(input) {
  input.removeAttribute('webkitdirectory');
  input.removeAttribute('directory');
  input.setAttribute('accept', '.zip,application/zip');
}

function handleFolderUpload(input) {
  handleFolderPick(input);
  resetFolderUploadInput(input);
}

function pickFolderOrZipInput() {
  var input = document.getElementById('folder-upload-input');
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
  input.onchange = function() {
    handleFolderUpload(input);
  };
  input.click();
}

async function walkDirectoryHandle(dirHandle, base) {
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
      var scope = getFolderScopeOptions();
      if (shouldIgnorePath(path + '/', scope)) continue;
      var sub = await walkDirectoryHandle(entry, path);
      results = results.concat(sub);
    }
  }
  return results;
}

function loadFromDirectoryHandle(dirHandle) {
  folderProjectFiles = [];
  folderProjectName = dirHandle.name || 'project';
  setFolderLoading(true);
  walkDirectoryHandle(dirHandle, '').then(function(files) {
    if (!files.length) {
      setFolderLoading(false);
      showToast('No supported files found', 'warning');
      return;
    }
    loadFolderFromFileList(files);
  }).catch(function(err) {
    setFolderLoading(false);
    showToast(err.message, 'error');
  });
}

function openFolderZipFilePicker() {
  var input = document.getElementById('folder-upload-input');
  if (!input) return;
  input.value = '';
  input.removeAttribute('webkitdirectory');
  input.removeAttribute('directory');
  input.setAttribute('accept', '.zip,application/zip');
  input.onchange = function() {
    handleFolderUpload(input);
  };
  input.click();
}

function openFolderUpload() {
  if (window.showDirectoryPicker) {
    window.showDirectoryPicker().then(loadFromDirectoryHandle).catch(function(err) {
      if (err.name === 'AbortError') openFolderZipFilePicker();
      else showToast(err.message, 'error');
    });
    return;
  }
  pickFolderOrZipInput();
}

function updateFolderSimValue() {
  var simRange = document.getElementById('folder-similarity');
  var valEl = document.getElementById('folder-sim-val');
  if (!simRange || !valEl) return;
  if (simRange.value == 100) {
    valEl.innerText = 'Exact Matches Only';
  } else {
    valEl.innerText = simRange.value + '% Similarity';
  }
}

function getFolderDemoFiles() {
  return [
  { path: 'my-project/data/users.csv', content: 'name,email\nalice,a@x.com\nbob,b@x.com\nalice,a@x.com', format: 'csv' },
  { path: 'my-project/backup/users-copy.csv', content: 'name,email\nalice,a@x.com\nbob,b@x.com\nalice,a@x.com', format: 'csv' },
  { path: 'my-project/logs/app.log', content: '[2024-01-01] INFO Started\n[2024-01-01] INFO Started\n[2024-01-02] ERROR fail', format: 'log' },
  { path: 'my-project/logs/app.log.bak', content: '[2024-01-01] INFO Started\n[2024-01-01] INFO Started\n[2024-01-02] ERROR fail', format: 'log' },
  { path: 'my-project/readme.md', content: '# My Project\n# My Project\nSetup complete.', format: 'txt' }
  ];
}

function updateFolderDemo() {
  var outputEl = document.getElementById('folder-example-output');
  var statusEl = document.getElementById('folder-example-status');
  if (!outputEl || typeof processFolderProject !== 'function') return;

  var modeEl = document.getElementById('folder-mode');
  var mode = modeEl ? modeEl.value : 'safe';
  var scopeOpts = getFolderScopeOptions();
  var snapshot = getFolderDemoFiles().map(function(f) {
    return { path: f.path, content: f.content, binary: false, binaryData: null, format: f.format };
  });

  try {
    var result = withOptionPrefix('folder-', function() {
      var lineOpts = getGlobalOptions('');
      return processFolderProject(snapshot, scopeOpts, lineOpts);
    });
    var s = result.stats;
    if (statusEl) {
      statusEl.textContent = 'Files: ' + s.totalFiles +
        ' | Removed: ' + s.filesRemoved +
        ' | Lines removed: ' + s.linesRemoved +
        ' | Modified: ' + s.filesModified +
        ' (' + FOLDER_MODE_LABELS[mode] + ')';
    }
    var highlights = result.report.filter(function(r) {
      return r.indexOf('Removed duplicate file') === 0 || r.indexOf(': removed') !== -1;
    });
    outputEl.value = highlights.length
      ? highlights.slice(0, 8).join('\n')
      : 'No duplicate files or lines found.';
    if (typeof window.refreshDemoPreview === 'function') window.refreshDemoPreview();
    if (typeof updateMediaDemo === 'function') updateMediaDemo();
  } catch (e) {
    if (statusEl) statusEl.textContent = '';
    outputEl.value = 'Demo unavailable';
  }
}

function deduplicateFolder() {
  if (!folderProjectFiles.length) {
    showToast('Load a folder or zip first', 'warning');
    return;
  }

  var container = document.getElementById('folder-output-container');
  var output = document.getElementById('folder-output');
  var status = document.getElementById('folder-status-text');
  var modeEl = document.getElementById('folder-mode');
  var mode = modeEl ? modeEl.value : 'safe';
  var scopeOpts = getFolderScopeOptions();
  var isReport = scopeOpts.reportOnly;

  if (container) {
    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth' });
  }
  if (status) status.textContent = 'Processing ' + folderProjectFiles.length + ' files...';

  logFolderActivity('Deduplicating ' + folderProjectFiles.length + ' files (' + FOLDER_MODE_LABELS[mode] + ')');

  setTimeout(function() {
    var prevLog = window.logActivity;
    window.logActivity = logFolderActivity;
    try {
      var start = performance.now();
      var snapshot = folderProjectFiles.map(function(f) {
        return {
          path: f.path,
          content: f.content,
          binary: f.binary,
          binaryData: f.binaryData,
          format: f.format
        };
      });
      var pipelineRun;
      withOptionPrefix('folder-', function() {
        var lineOpts = getGlobalOptions('');
        pipelineRun = typeof runFolderPipeline === 'function'
          ? runFolderPipeline(snapshot, scopeOpts, lineOpts)
          : { result: processFolderProject(snapshot, scopeOpts, lineOpts), verification: { passed: true, summary: 'ok' }, attempts: [] };
      });
      var result = pipelineRun.result;
      window.lastFolderPipelineRun = pipelineRun;
      var elapsed = Math.round(performance.now() - start);
      var s = result.stats;
      var verifyNote = pipelineRun.verification ? pipelineRun.verification.summary : '';

      if (!isReport) folderProcessedResult = result;
      else folderProcessedResult = { files: snapshot, stats: s, report: result.report };

      if (output) output.value = buildFolderReportText(result, elapsed, FOLDER_MODE_LABELS[mode]);
      if (status) {
        if (isReport) {
          status.textContent = 'Scanned ' + s.totalFiles + ' files | ' + s.duplicateCodeBlocks + ' code duplicates found (' + elapsed + 'ms)';
        } else {
          status.textContent = 'Files: ' + s.totalFiles +
            ' | Removed: ' + s.filesRemoved +
            ' | Lines removed: ' + s.linesRemoved +
            ' | Modified: ' + s.filesModified +
            (s.passthroughFiles ? ' | Unchanged: ' + s.passthroughFiles : '') +
            ' (' + elapsed + 'ms)';
        }
      }
      showToast(isReport ? 'Scan complete' : 'Successfully deduplicated project!', 'success');
      logFolderActivity('Done in ' + elapsed + 'ms' + (verifyNote ? ' | ' + verifyNote : ''));
    } catch (e) {
      console.error(e);
      showToast('Error: ' + e.message, 'error');
      if (status) status.textContent = 'Error: ' + e.message;
      logFolderActivity('ERROR: ' + e.message);
    } finally {
      window.logActivity = prevLog;
    }
  }, 30);
}

function revertFolderProject() {
  if (typeof revertLastPipelineRun !== 'function') return false;
  var restored = revertLastPipelineRun();
  if (!restored || restored.type !== 'folder' || !restored.files) return false;
  folderProjectFiles = restored.files.map(function(f) {
    return {
      path: f.path,
      content: f.content,
      binary: !!f.binary,
      binaryData: f.binaryData || null,
      format: f.format || detectFormatFromPath(f.path, f.content)
    };
  });
  folderProcessedResult = null;
  updateFolderManifest();
  var output = document.getElementById('folder-output');
  if (output) output.value = '';
  showToast('Reverted folder project to pre-dedup checkpoint', 'success');
  logFolderActivity('Reverted folder project to checkpoint');
  return true;
}

function clearFolderProject() {
  folderProjectFiles = [];
  folderProcessedResult = null;
  folderProjectName = '';
  setFolderLoading(false);
  updateFolderManifest();

  var output = document.getElementById('folder-output');
  var status = document.getElementById('folder-status-text');
  var container = document.getElementById('folder-output-container');
  if (output) output.value = '';
  if (status) status.textContent = '';
  if (container) container.style.display = 'none';
  showToast('Workspace cleared', 'success');
  logFolderActivity('Workspace cleared');
}

function copyFolderOutput() {
  var output = document.getElementById('folder-output');
  if (!output || !output.value.trim()) return;
  output.select();
  document.execCommand('copy');
  var btn = document.getElementById('folder-btn-copy');
  if (btn) {
    var orig = btn.innerText;
    btn.innerText = 'Copied!';
    setTimeout(function() { btn.innerText = orig; }, 2000);
  }
  showToast('Copied to clipboard!', 'success');
}

function downloadFolderZip() {
  var files = folderProcessedResult && folderProcessedResult.files;
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
    if (f.binary && f.binaryData) zip.file(f.path, f.binaryData);
    else zip.file(f.path, f.content != null ? f.content : '');
  });

  zip.generateAsync({ type: 'blob' }).then(function(blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (folderProjectName || 'deduplicated-project') + '.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    var btn = document.getElementById('folder-btn-download');
    if (btn) {
      var orig = btn.innerText;
      btn.innerText = 'Downloaded!';
      setTimeout(function() { btn.innerText = orig; }, 2000);
    }
    showToast('Downloaded ' + a.download, 'success');
    logFolderActivity('Downloaded zip (' + files.length + ' files)');
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

function initFolderTab() {
  var manifest = document.getElementById('folder-manifest');
  if (manifest) {
    ['dragenter', 'dragover'].forEach(function(ev) {
      manifest.addEventListener(ev, function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!folderIsLoading) manifest.classList.add('drag-over');
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
      handleFolderDrop(e.dataTransfer);
    });
  }

  updateFolderManifest();
}

function bootFolderApp() {
  initFolderTab();
  updateFolderSimValue();
  updateFolderDemo();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootFolderApp);
} else {
  bootFolderApp();
}
