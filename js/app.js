// Geckodupe Main Controller & Engine Router
// Integrates all niche parsing engines, UI state, drag-and-drop, error toast system, activity logger, and dual binary/text export

var currentFormatMode = 'txt';
var hasDetectedFile = false;
var activityEventCount = 0;

// - - - - - TOAST NOTIFICATION SYSTEM - - - - -
function getActivePageTitleEl() {
  var section = document.querySelector('main section.current');
  if (section) {
    return section.querySelector('.main-header') || section.querySelector('h1');
  }
  return document.querySelector('.main-header') || document.querySelector('h1');
}

function checkMobileToastPosition() {
  var container = document.getElementById('toast-container');
  if (!container) return;
  if (window.innerWidth <= 850) {
    var titleEl = getActivePageTitleEl();
    if (titleEl && titleEl.getBoundingClientRect().bottom < 0) {
      container.classList.add('toast-top-mode');
    } else {
      container.classList.remove('toast-top-mode');
    }
  } else {
    container.classList.remove('toast-top-mode');
  }
}

function showToast(msg, type) {
  var container = document.getElementById('toast-container');
  if (!container) return;
  checkMobileToastPosition();
  var toast = document.createElement('div');
  toast.className = 'toast ' + (type || 'success');
  
  var textSpan = document.createElement('span');
  textSpan.innerText = msg;
  
  function dismissToast() {
    if (!toast.parentNode) return;
    toast.classList.add('toast-hide');
    setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
  }

  var closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = dismissToast;
  
  toast.appendChild(textSpan);
  toast.appendChild(closeBtn);
  container.appendChild(toast);
  
  setTimeout(dismissToast, 5000);
}

// - - - - - ACTIVITY & DIAGNOSTICS LOG SYSTEM - - - - -
function logActivity(msg) {
  var contentEl = document.getElementById('activity-log-content');
  var badgeEl = document.getElementById('activity-log-badge');
  if (!contentEl) return;
  
  var now = new Date();
  var timeStr = '[' + now.toTimeString().split(' ')[0] + '.' + ('00' + now.getMilliseconds()).slice(-3) + ']';
  
  var entry = document.createElement('div');
  entry.className = 'activity-entry';
  entry.innerHTML = '<span class="timestamp">' + timeStr + '</span>' + msg;
  
  contentEl.insertBefore(entry, contentEl.firstChild);
  activityEventCount++;
  if (badgeEl) badgeEl.innerText = activityEventCount + ' events';
}

function toggleActivityLog() {
  var panel = document.getElementById('activity-log-panel');
  var arrow = document.getElementById('activity-log-arrow');
  if (panel) {
    var isHidden = panel.style.display === 'none';
    panel.style.display = isHidden ? 'block' : 'none';
    if (arrow) {
      arrow.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
    }
  }
}

function clearActivityLog() {
  var contentEl = document.getElementById('activity-log-content');
  var badgeEl = document.getElementById('activity-log-badge');
  if (contentEl) contentEl.innerHTML = '';
  activityEventCount = 0;
  if (badgeEl) badgeEl.innerText = '0 events';
  showToast("Diagnostics log cleared", "success");
}

function setFormatMode(mode) {
  currentFormatMode = mode;
  if (typeof preloadLib === 'function') {
    if (mode === 'csv') preloadLib('papaparse');
    if (mode === 'excel') preloadLib('xlsx');
  }
  var textSection = document.getElementById('s-1');
  if (textSection) {
    textSection.querySelectorAll('.format-options-sub').forEach(function(el) {
      el.style.display = 'none';
    });
  }
  var subEl = document.getElementById('format-options-' + mode);
  if (subEl) {
    subEl.style.display = 'flex';
  }

  var dlBtn = document.getElementById('btn-download');
  if (dlBtn) {
    var extMap = {
      'txt': '.txt',
      'csv': '.csv',
      'excel': '.xlsx',
      'json': '.json',
      'log': '.log',
      'code': '.py / .js',
      'todo': '.todo'
    };
    dlBtn.innerText = 'Download (' + (extMap[mode] || '.txt') + ')';
  }
  logActivity("Switched format engine mode to: " + mode.toUpperCase());
}

function detectFormatFromFile(filename) {
  hasDetectedFile = true;
  if (typeof sniffFormat === 'function') {
    var sniff = sniffFormat(filename, '');
    if (sniff.mode && sniff.mode !== 'skip' && sniff.confidence >= 0.15) {
      setFormatMode(sniff.mode);
      return;
    }
  }
  var lower = filename.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) setFormatMode('excel');
  else if (lower.endsWith('.csv') || lower.endsWith('.tsv')) setFormatMode('csv');
  else if (lower.endsWith('.json') || lower.endsWith('.jsonl') || lower.endsWith('.yaml') || lower.endsWith('.yml') || lower.endsWith('.xml')) setFormatMode('json');
  else if (lower.endsWith('.log') || lower.endsWith('.sql')) setFormatMode('log');
  else if (lower.endsWith('.py') || lower.endsWith('.js') || lower.endsWith('.ts') || lower.endsWith('.html') || lower.endsWith('.css') || lower.endsWith('.sh') || lower.endsWith('.java') || lower.endsWith('.cpp')) setFormatMode('code');
  else if (lower.endsWith('.todo') || lower.endsWith('.list') || lower.indexOf('todo') !== -1 || lower.indexOf('shopping') !== -1) setFormatMode('todo');
  else setFormatMode('txt');
  updateLiveExample();
}

function autoDetectFromContent(txt) {
  if (hasDetectedFile || !txt || !txt.trim()) return;
  if (typeof sniffFormat === 'function') {
    var sniff = sniffFormat('', txt);
    if (sniff.mode && sniff.confidence >= 0.22) {
      if (currentFormatMode !== sniff.mode) setFormatMode(sniff.mode);
      return;
    }
  }
  var lines = txt.trim().split('\n');
  var firstFew = lines.slice(0, 15).join('\n');
  
  if (firstFew.match(/\[\d{4}-\d{2}-\d{2}/) || firstFew.match(/\d{4}-\d{2}-\d{2}[T ]/) || firstFew.match(/\bPID[:=]?\s*\[?\d+/i) || firstFew.match(/\bVALUES\s*\(/i)) {
    if (currentFormatMode !== 'log') setFormatMode('log');
  } else if ((firstFew.trim().startsWith('{') && firstFew.trim().endsWith('}')) || (firstFew.trim().startsWith('[') && firstFew.trim().endsWith(']'))) {
    if (currentFormatMode !== 'json') setFormatMode('json');
  } else if (firstFew.match(/^\s*(?:[\*\-\+]|\d+\.)?\s*\[[ xX_/]\]/) || firstFew.match(/^\s*(?:TODO|DONE|WAITING|COMPLETED):\s*/i)) {
    if (currentFormatMode !== 'todo') setFormatMode('todo');
  } else if (firstFew.match(/\b(?:import|export|function|const|let|var|class|def|return)\b/) || firstFew.match(/^\s*(?:\/\/|#)\s+/)) {
    if (currentFormatMode !== 'code') setFormatMode('code');
  } else if (lines.length > 1 && lines[0].indexOf(',') !== -1 && lines[0].split(',').length > 2 && lines[1].split(',').length === lines[0].split(',').length) {
    if (currentFormatMode !== 'csv') setFormatMode('csv');
  } else {
    if (currentFormatMode !== 'txt') setFormatMode('txt');
  }
}

function getGlobalOptions(optionPrefix) {
  var prev = typeof geckodupeOptionPrefix !== 'undefined' ? geckodupeOptionPrefix : '';
  if (typeof setOptionPrefix === 'function') setOptionPrefix(optionPrefix || '');
  try {
    var doStack = typeof isEngineChecked === 'function' ? isEngineChecked('stack', true) : false;
    var doCaps = typeof isEngineChecked === 'function' ? isEngineChecked('caps', false) : false;
    var doBlanks = typeof isEngineChecked === 'function' ? isEngineChecked('kpblanks', false) : false;
    var sortOrder = typeof getEngineValue === 'function'
      ? getEngineValue('sort-order', 'original')
      : 'original';
    if (sortOrder === 'original' && typeof isEngineChecked === 'function' && isEngineChecked('sort', false)) {
      sortOrder = 'alpha-asc';
    }
    var filterMode = typeof getEngineValue === 'function' ? getEngineValue('filter-mode', 'all') : 'all';
    var ignorePunct = typeof isEngineChecked === 'function' ? isEngineChecked('ignore-punct', false) : false;
    var collapseWs = typeof isEngineChecked === 'function' ? isEngineChecked('collapse-ws', false) : false;
    var simEl = typeof getEngineEl === 'function' ? getEngineEl('similarity') : null;
    var simVal = simEl ? simEl.value : 100;
    var simThreshold = simVal == 100 ? 1 : simVal / 100;

    return {
      doStack: doStack,
      doCaps: doCaps,
      doBlanks: doBlanks,
      sortOrder: sortOrder,
      simThreshold: simThreshold,
      filterMode: filterMode,
      ignorePunct: ignorePunct,
      collapseWs: collapseWs
    };
  } finally {
    if (typeof setOptionPrefix === 'function') setOptionPrefix(prev);
  }
}

function getFolderOptions() {
  return getGlobalOptions('folder-');
}

function processLines(txt, doStack, doCaps, doBlanks, sortOrder, simThreshold, filterMode, ignorePunct, collapseWs, pipelineMode) {
  try {
    var mode = pipelineMode || 'fast';
    if (typeof runTextPipeline === 'function') {
      var run = runTextPipeline(txt, {
        doStack: doStack,
        doCaps: doCaps,
        doBlanks: doBlanks,
        sortOrder: sortOrder,
        simThreshold: simThreshold,
        filterMode: filterMode,
        ignorePunct: ignorePunct,
        collapseWs: collapseWs,
        mode: currentFormatMode,
        autoDetect: false,
        fast: mode === 'fast',
        sniff: mode !== 'fast'
      });
      if (mode === 'full') {
        window.lastPipelineRun = run;
      }
      if (run.result && run.result.error) {
        throw new Error(run.result.error);
      }
      return run.result;
    }
    if (currentFormatMode === 'excel') return processExcel(txt, doStack, doCaps, doBlanks, sortOrder, simThreshold, filterMode, ignorePunct, collapseWs);
    if (currentFormatMode === 'csv') return processCsv(txt, doStack, doCaps, doBlanks, sortOrder, simThreshold, filterMode, ignorePunct, collapseWs);
    if (currentFormatMode === 'json') return processJson(txt, doStack, doCaps, doBlanks, sortOrder, simThreshold, filterMode, ignorePunct, collapseWs);
    if (currentFormatMode === 'log') return processLog(txt, doStack, doCaps, doBlanks, sortOrder, simThreshold, filterMode, ignorePunct, collapseWs);
    if (currentFormatMode === 'code') return processCode(txt, doStack, doCaps, doBlanks, sortOrder, simThreshold, filterMode, ignorePunct, collapseWs);
    if (currentFormatMode === 'todo') return processTodo(txt, doStack, doCaps, doBlanks, sortOrder, simThreshold, filterMode, ignorePunct, collapseWs);
    return processPlainLines(txt, doStack, doCaps, doBlanks, sortOrder, simThreshold, currentFormatMode, filterMode, ignorePunct, collapseWs);
  } catch (e) {
    console.error("Engine Error:", e);
    showToast("Error processing data: " + e.message, "error");
    logActivity("ERROR in engine [" + currentFormatMode + "]: " + e.message);
    return { lines: ["Error processing data: " + e.message], total: 0, removed: 0, remaining: 0 };
  }
}

function revertLastDeduplication() {
  if (typeof revertLastPipelineRun !== 'function') return false;
  var restored = revertLastPipelineRun();
  if (!restored || restored.type !== 'text') return false;
  var masterEl = document.getElementById('masterlist');
  var outputEl = document.getElementById('output');
  if (masterEl && restored.input != null) masterEl.value = restored.input;
  if (outputEl) outputEl.value = restored.output || '';
  showToast('Reverted to pre-dedup checkpoint', 'success');
  logActivity('Reverted text workspace to checkpoint [' + (restored.checkpointBeforeId || 'latest') + ']');
  return true;
}

function getPipelineDiagnostics() {
  var run = typeof getLastPipelineRun === 'function' ? getLastPipelineRun() : (window.lastPipelineRun || null);
  if (!run) return null;
  return {
    mode: run.mode,
    verification: run.verification,
    attempts: run.attempts,
    profile: run.profile,
    checkpointId: run.checkpointId,
    canRevert: run.canRevert
  };
}

function updateSimValue() {
  var simRange = document.getElementById('similarity');
  var valEl = document.getElementById('sim-val');
  if (!simRange || !valEl) return;
  if (simRange.value == 100) {
    valEl.innerText = "Exact Matches Only";
  } else {
    valEl.innerText = simRange.value + "% Similarity";
  }
}

function updateLiveExample() {
  var inputEl = document.getElementById('example-input');
  if (inputEl) {
    var exampleText = inputEl.value || inputEl.innerText || inputEl.textContent;
    var opts = getGlobalOptions();
    var result = processLines(exampleText, opts.doStack, opts.doCaps, opts.doBlanks, opts.sortOrder, opts.simThreshold, opts.filterMode, opts.ignorePunct, opts.collapseWs);
    var outputEl = document.getElementById('example-output');
    var statusEl = document.getElementById('example-status');
    if (outputEl) {
      outputEl.value = result.lines.join('\n');
    }
    if (statusEl) {
      statusEl.textContent = 'Total Input: ' + result.total + ' | Removed Duplicates: ' + result.removed + ' | Remaining Unique: ' + result.remaining;
    }
    if (typeof window.refreshDemoPreview === 'function') window.refreshDemoPreview();
  }
}

function runDeduplicate() {
  var masterEl = document.getElementById('masterlist');
  var masterlistText = masterEl ? masterEl.value : '';
  var opts = getGlobalOptions();
  var linesCount = masterlistText.split('\n').length;

  var statusEl = document.getElementById('status-text');
  var containerEl = document.getElementById('output-container');
  var outputEl = document.getElementById('output');

  if (linesCount > 5000 && opts.simThreshold < 1) {
    if (statusEl) statusEl.innerText = "Processing large dataset (" + linesCount + " lines) asynchronously... Please wait.";
    showToast("Processing " + linesCount + " lines in background...", "warning");
    logActivity("Started async batch processing for " + linesCount + " lines (sim=" + Math.round(opts.simThreshold*100) + "%)");

    setTimeout(function() {
      var startTime = performance.now();
      var result = processLines(masterlistText, opts.doStack, opts.doCaps, opts.doBlanks, opts.sortOrder, opts.simThreshold, opts.filterMode, opts.ignorePunct, opts.collapseWs, 'full');
      var elapsed = Math.round(performance.now() - startTime);

      if (outputEl) outputEl.value = result.lines.join('\n');
      if (statusEl) statusEl.innerText = "Total Input: " + result.total + " | Removed Duplicates: " + result.removed + " | Remaining Unique: " + result.remaining + " (" + elapsed + "ms)";
      showToast("Deduplication complete in " + elapsed + "ms!", "success");
      logActivity("Completed deduplication in " + elapsed + "ms: " + result.total + " -> " + result.remaining + " unique lines.");
    }, 50);
  } else {
    var startTime = performance.now();
    var result = processLines(masterlistText, opts.doStack, opts.doCaps, opts.doBlanks, opts.sortOrder, opts.simThreshold, opts.filterMode, opts.ignorePunct, opts.collapseWs, 'full');
    var elapsed = Math.round(performance.now() - startTime);

    if (outputEl) outputEl.value = result.lines.join('\n');
    if (statusEl) {
      if (result.total === 0) {
        statusEl.innerText = "Please paste or drag & drop data above.";
      } else {
        statusEl.innerText = "Total Input: " + result.total + " | Removed Duplicates: " + result.removed + " | Remaining Unique: " + result.remaining + " (" + elapsed + "ms)";
      }
    }
    if (result.total > 0) {
      var diag = typeof getPipelineDiagnostics === 'function' ? getPipelineDiagnostics() : null;
      var verifyNote = diag && diag.verification ? ' [' + diag.verification.summary + ']' : '';
      showToast("Successfully deduplicated " + result.total + " lines!", "success");
      logActivity("Deduplicated " + result.total + " lines (" + result.removed + " removed) in " + elapsed + "ms [Mode: " + currentFormatMode.toUpperCase() + "]" + verifyNote);
    }
  }
}

function deduplicate() {
  var masterEl = document.getElementById('masterlist');
  var masterlistText = masterEl ? masterEl.value : '';

  autoDetectFromContent(masterlistText);

  var containerEl = document.getElementById('output-container');
  if (containerEl) {
    containerEl.style.display = 'block';
    containerEl.scrollIntoView({ behavior: 'smooth' });
  }

  var loadLibs = typeof ensureLibsForFormat === 'function'
    ? ensureLibsForFormat(currentFormatMode)
    : Promise.resolve();

  loadLibs.then(runDeduplicate).catch(function (e) {
    showToast('Failed to load required library: ' + e.message, 'error');
    logActivity('ERROR loading library: ' + e.message);
  });
}

function clearAll() {
  hasDetectedFile = false;
  setFormatMode('txt');
  var masterEl = document.getElementById('masterlist');
  if (masterEl) {
    masterEl.value = '';
    masterEl.focus();
  }
  var containerEl = document.getElementById('output-container');
  if (containerEl) {
    containerEl.style.display = 'none';
  }
  var statusEl = document.getElementById('status-text');
  if (statusEl) statusEl.innerText = '';
  showToast("Workspace cleared", "success");
  logActivity("Cleared workspace and reset engine mode to TXT");
}

function copyOutput() {
  var output = document.getElementById('output');
  if (!output || !output.value.trim()) return;
  output.select();
  document.execCommand('copy');
  
  var btn = document.getElementById('btn-copy');
  if (btn) {
    var origText = btn.innerText;
    btn.innerText = 'Copied!';
    setTimeout(function() {
      btn.innerText = origText;
    }, 2000);
  }
  showToast("Copied results to clipboard!", "success");
  logActivity("Copied output (" + output.value.split('\n').length + " lines) to clipboard");
}

function downloadOutput() {
  var output = document.getElementById('output');
  if (!output || !output.value.trim()) return;

  function doDownload() {
    try {
      if (currentFormatMode === 'excel') {
        downloadExcelWorkbook(output.value, 'deduplicated-output.xlsx');
      var btn = document.getElementById('btn-download');
      if (btn) {
        var origText = btn.innerText;
        btn.innerText = 'Downloaded!';
        setTimeout(function () { btn.innerText = origText; }, 2000);
      }
      showToast("Downloaded Excel workbook (.xlsx)", "success");
      logActivity("Exported output as binary Excel workbook (.xlsx)");
      return;
    }

    var extMap = { 'txt': 'txt', 'csv': 'csv', 'json': 'json', 'log': 'log', 'code': 'code.txt', 'todo': 'todo.txt' };
    var ext = extMap[currentFormatMode] || 'txt';
    var mimeMap = { 'txt': 'text/plain', 'csv': 'text/csv', 'json': 'application/json', 'log': 'text/plain', 'code': 'text/plain', 'todo': 'text/plain' };
    var mime = mimeMap[currentFormatMode] || 'text/plain';

    var blob = new Blob([output.value], { type: mime + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'deduplicated-output.' + ext;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    var btn = document.getElementById('btn-download');
    if (btn) {
      var origText = btn.innerText;
      btn.innerText = 'Downloaded!';
      setTimeout(function () { btn.innerText = origText; }, 2000);
    }
    showToast("Downloaded file: deduplicated-output." + ext, "success");
    logActivity("Exported output as text file (." + ext + ")");
    } catch (e) {
      console.error("Download Error:", e);
      showToast("Failed to generate download: " + e.message, "error");
      logActivity("ERROR generating download: " + e.message);
    }
  }

  if (currentFormatMode === 'excel' && typeof ensureLib === 'function') {
    ensureLib('xlsx').then(doDownload).catch(function (e) {
      showToast('Failed to load Excel library: ' + e.message, 'error');
    });
    return;
  }
  doDownload();
}

function handleFileRead(file, content, isBinary, idx, totalFiles, masterlistEl, callback) {
  try {
    if (isBinary) {
      loadExcelWorkbook(content, file.name, function(csvText) {
        if (masterlistEl.value.trim() !== '') {
          masterlistEl.value += '\n' + csvText;
        } else {
          masterlistEl.value = csvText;
        }
        logActivity("Loaded Excel binary file: " + file.name + " (" + csvText.split('\n').length + " rows)");
        showToast("Loaded Excel file: " + file.name, "success");
        if (callback) callback();
        if (idx === totalFiles - 1) masterlistEl.focus();
      });
    } else {
      if (masterlistEl.value.trim() !== '') {
        masterlistEl.value += '\n' + content;
      } else {
        masterlistEl.value = content;
      }
      logActivity("Loaded text file: " + file.name + " (" + content.split('\n').length + " lines)");
      showToast("Loaded file: " + file.name, "success");
      if (callback) callback();
      if (idx === totalFiles - 1) masterlistEl.focus();
    }
  } catch (e) {
    console.error("File Read Error:", e);
    showToast("Error reading file " + file.name + ": " + e.message, "error");
    logActivity("ERROR reading " + file.name + ": " + e.message);
    if (callback) callback();
  }
}

function readFilesSequentially(files, idx, masterlistEl) {
  if (!files || idx >= files.length) {
    if (files && files.length > 0) autoDetectFromContent(masterlistEl.value);
    return;
  }
  var file = files[idx];
  detectFormatFromFile(file.name);
  var lower = file.name.toLowerCase();
  var isBinary = (lower.endsWith('.xlsx') || lower.endsWith('.xls'));
  var reader = new FileReader();
  
  reader.onload = function(evt) {
    handleFileRead(file, evt.target.result, isBinary, idx, files.length, masterlistEl, function() {
      readFilesSequentially(files, idx + 1, masterlistEl);
    });
  };
  reader.onerror = function(evt) {
    showToast("Failed to read file: " + file.name, "error");
    logActivity("ERROR reading file: " + file.name);
    readFilesSequentially(files, idx + 1, masterlistEl);
  };
  
  if (isBinary) {
    var startRead = function () { reader.readAsArrayBuffer(file); };
    if (typeof ensureLib === 'function') {
      ensureLib('xlsx').then(startRead).catch(function (e) {
        showToast('Failed to load Excel library: ' + e.message, 'error');
        readFilesSequentially(files, idx + 1, masterlistEl);
      });
    } else {
      startRead();
    }
  } else {
    reader.readAsText(file);
  }
}

function handleMobileUpload(inputEl) {
  if (!inputEl.files || inputEl.files.length === 0) return;
  var masterlistEl = document.getElementById('masterlist');
  if (!masterlistEl) return;
  readFilesSequentially(inputEl.files, 0, masterlistEl);
}

var tabSlugToId = {};
var tabIdToSlug = {};
var TAB_PAGE_TITLES = {
  '1': 'Text / File',
  '2': 'Demo',
  '3': 'How It Works',
  '4': 'Folder / Zip',
  '5': 'Img / Vid'
};

function updatePageTitle(tabId) {
  var pageTitle = TAB_PAGE_TITLES[String(tabId)] || TAB_PAGE_TITLES['1'];
  document.title = pageTitle + ' - Geckodupe';
}

function buildTabRoutes() {
  tabSlugToId = { 'text': '1', 'file': '1', 'folder': '4' };
  tabIdToSlug = {};
  document.querySelectorAll('.tabs li[data-slug]').forEach(function(li) {
    var tabId = li.id.replace('t-', '');
    var slug = li.getAttribute('data-slug');
    if (!tabId || !slug) return;
    tabSlugToId[slug.toLowerCase()] = tabId;
    tabIdToSlug[tabId] = slug;
  });
}

function getTabIdFromHash() {
  var hash = (location.hash || '').replace(/^#/, '').trim().toLowerCase();
  if (!hash) return '1';
  return tabSlugToId[hash] || '1';
}

function onTabActivated(tabId) {
  var ready = typeof ensureTabScripts === 'function'
    ? ensureTabScripts(tabId)
    : Promise.resolve();

  if (tabId === '2') {
    ready.then(function () {
      if (typeof updateFolderDemo === 'function') updateFolderDemo();
      if (typeof updateMediaDemo === 'function') updateMediaDemo();
    });
  }
  if (tabId === '3') {
    ready.then(function () {
      if (typeof ensureLib === 'function') return ensureLib('d3');
    }).then(function () {
      if (typeof renderInfoStats === 'function') renderInfoStats();
    }).catch(function () {
      if (typeof renderInfoStats === 'function') renderInfoStats();
    });
  }
  if (tabId === '4') {
    ready.then(function () {
      if (typeof window.initCustomDropdowns === 'function') {
        var section = document.getElementById('s-4');
        if (section) window.initCustomDropdowns(section);
      }
    });
  }
  if (tabId === '5') {
    ready.then(function () {
      if (typeof window.initCustomDropdowns === 'function') {
        var mediaSection = document.getElementById('s-5');
        if (mediaSection) window.initCustomDropdowns(mediaSection);
      }
    });
    if (typeof preloadLib === 'function') preloadLib('jszip');
  }
}

function switchToTab(tabId, options) {
  options = options || {};
  tabId = String(tabId);
  if (!tabIdToSlug[tabId]) tabId = '1';

  document.querySelectorAll('.tabs li').forEach(function(li) {
    li.classList.remove('current');
    li.setAttribute('aria-selected', 'false');
    li.setAttribute('tabindex', '-1');
  });
  document.querySelectorAll('main section').forEach(function(sec) {
    sec.classList.remove('current');
    sec.setAttribute('hidden', '');
  });

  var tabEl = document.getElementById('t-' + tabId);
  var sectionEl = document.getElementById('s-' + tabId);
  if (tabEl) {
    tabEl.classList.add('current');
    tabEl.setAttribute('aria-selected', 'true');
    tabEl.setAttribute('tabindex', '0');
  }
  if (sectionEl) {
    sectionEl.classList.add('current');
    sectionEl.removeAttribute('hidden');
  }

  if (!options.skipHash) {
    var slug = tabIdToSlug[tabId];
    if (slug && location.hash.replace(/^#/, '') !== slug) {
      location.hash = slug;
      return;
    }
  }

  updatePageTitle(tabId);
  onTabActivated(tabId);
  checkMobileToastPosition();
}

function applyRouteFromHash() {
  var hash = (location.hash || '').replace(/^#/, '').trim().toLowerCase();
  if (hash && !tabSlugToId[hash]) {
    history.replaceState(null, '', '#' + (tabIdToSlug['1'] || 'text-file'));
  }
  switchToTab(getTabIdFromHash(), { skipHash: true });
}

// Initialize application on DOM load
document.addEventListener('DOMContentLoaded', function() {
  buildTabRoutes();

  document.querySelectorAll('.tabs li').forEach(function(li) {
    li.addEventListener('click', function() {
      var url = li.getAttribute('data-url');
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
      var tabId = li.id.replace('t-', '');
      if (tabIdToSlug[tabId]) location.hash = tabIdToSlug[tabId];
    });
  });

  window.addEventListener('hashchange', applyRouteFromHash);

  if (location.hash) {
    applyRouteFromHash();
  } else {
    history.replaceState(null, '', '#' + (tabIdToSlug['1'] || 'text-file'));
  }

  document.addEventListener('click', function() {
    document.querySelectorAll('.custom-dropdown-wrapper.open').forEach(function(w) { w.classList.remove('open'); });
  });

  // Init Drag and Drop
  var masterlistEl = document.getElementById('masterlist');
  if (masterlistEl) {
    masterlistEl.addEventListener('input', function() {
      autoDetectFromContent(this.value);
    });

    window.addEventListener('dragover', function(e) { e.preventDefault(); }, false);
    window.addEventListener('drop', function(e) { e.preventDefault(); }, false);

    ['dragenter', 'dragover'].forEach(function(eventName) {
      masterlistEl.addEventListener(eventName, function(e) {
        e.preventDefault();
        e.stopPropagation();
        masterlistEl.classList.add('drag-over');
      }, false);
    });

    ['dragleave', 'drop'].forEach(function(eventName) {
      masterlistEl.addEventListener(eventName, function(e) {
        e.preventDefault();
        e.stopPropagation();
        masterlistEl.classList.remove('drag-over');
      }, false);
    });

      masterlistEl.addEventListener('drop', function(e) {
      var dt = e.dataTransfer;
      var files = dt.files;
      if (files && files.length > 0) {
        readFilesSequentially(files, 0, masterlistEl);
      }
    }, false);
  }

  window.addEventListener('scroll', checkMobileToastPosition, { passive: true });
  window.addEventListener('resize', checkMobileToastPosition, { passive: true });

  function initCustomDropdowns(root) {
    var scope = root || document;
    var selects = scope.querySelectorAll('select.styled-select');
    selects.forEach(function(select) {
      if (select.dataset.customized) return;
      select.dataset.customized = 'true';
      select.style.display = 'none';

      var wrapper = document.createElement('div');
      wrapper.className = 'custom-dropdown-wrapper';

      var trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'custom-dropdown-trigger';

      var labelSpan = document.createElement('span');
      labelSpan.className = 'custom-dropdown-label';
      var selectedOpt = select.options[select.selectedIndex] || select.options[0];
      labelSpan.innerText = selectedOpt ? selectedOpt.text : '';

      var arrowSpan = document.createElement('span');
      arrowSpan.className = 'custom-dropdown-arrow';
      arrowSpan.innerHTML = '&#9662;';

      trigger.appendChild(labelSpan);
      trigger.appendChild(arrowSpan);

      var menu = document.createElement('div');
      menu.className = 'custom-dropdown-menu';

      Array.from(select.options).forEach(function(opt, idx) {
        var item = document.createElement('div');
        item.className = 'custom-dropdown-option' + (idx === select.selectedIndex ? ' selected' : '');
        item.innerText = opt.text;
        item.dataset.value = opt.value;

        item.addEventListener('click', function(e) {
          e.stopPropagation();
          select.value = opt.value;
          labelSpan.innerText = opt.text;
          menu.querySelectorAll('.custom-dropdown-option').forEach(function(o) { o.classList.remove('selected'); });
          item.classList.add('selected');
          wrapper.classList.remove('open');
          if (select.onchange) {
            try { select.onchange(); } catch (err) { /* ignore */ }
          }
          if (typeof updateLiveExample === 'function') updateLiveExample();
          if (typeof updateFolderDemo === 'function') updateFolderDemo();
          if (typeof updateMediaDemo === 'function') updateMediaDemo();
        });

        menu.appendChild(item);
      });

      trigger.addEventListener('click', function(e) {
        e.stopPropagation();
        var wasOpen = wrapper.classList.contains('open');
        document.querySelectorAll('.custom-dropdown-wrapper.open').forEach(function(w) { w.classList.remove('open'); });
        if (!wasOpen) wrapper.classList.add('open');
      });

      wrapper.appendChild(trigger);
      wrapper.appendChild(menu);
      select.parentNode.insertBefore(wrapper, select);
    });
  }

  window.initCustomDropdowns = initCustomDropdowns;

  initCustomDropdowns();
  logActivity("Geckodupe Engine initialized successfully");
  updateLiveExample();
});
