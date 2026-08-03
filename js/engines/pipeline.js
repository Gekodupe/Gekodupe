var GECKO_LAST_PIPELINE_RUN = null;
var GECKO_PIPELINE_MAX_RETRIES = 3;

var GECKO_RETRY_STRATEGIES = [
  {
    name: 'primary',
    adjust: function(ctx) { return ctx; }
  },
  {
    name: 'format-fallback',
    adjust: function(ctx) {
      var next = geckoDeepClone(ctx);
      next.mode = 'txt';
      next.note = 'Fell back to plain-text engine';
      return next;
    }
  },
  {
    name: 'relaxed-matching',
    adjust: function(ctx) {
      var next = geckoDeepClone(ctx);
      if (next.lineOpts.simThreshold >= 1) next.lineOpts.simThreshold = 0.92;
      else next.lineOpts.simThreshold = Math.max(0.5, next.lineOpts.simThreshold - 0.08);
      next.lineOpts.collapseWs = true;
      next.lineOpts.ignorePunct = true;
      next.note = 'Relaxed similarity + whitespace/punctuation normalization';
      return next;
    }
  }
];

var TEXT_ENGINES = {
  excel: processExcel,
  csv: processCsv,
  json: processJson,
  log: processLog,
  code: processCode,
  todo: processTodo
};

function invokeTextEngine(txt, mode, lineOpts) {
  var o = lineOpts;
  var fn = TEXT_ENGINES[mode];
  if (fn) return fn.apply(null, [txt].concat(engineArgs(o)));
  return processPlainLines(txt, o.doStack, o.doCaps, o.doBlanks, o.sortOrder, o.simThreshold, mode || 'txt', o.filterMode, o.ignorePunct, o.collapseWs);
}

function resolveTextMode(txt, path, explicitMode, autoDetect) {
  if (explicitMode && explicitMode !== 'auto' && !autoDetect) return explicitMode;
  var sniff = sniffFormat(path || '', txt || '');
  if (sniff.mode && sniff.mode !== 'skip' && sniff.confidence >= 0.2) return sniff.mode;
  return explicitMode || 'txt';
}

function runTextPipeline(txt, options) {
  options = options || {};

  if (options.fast) {
    var fastOpts = buildLineOpts(options);
    var fastMode = options.mode || 'txt';
    var fastResult = invokeTextEngine(txt, fastMode, fastOpts);
    return {
      type: 'text',
      result: fastResult,
      verification: { passed: true, checks: [], summary: 'Fast path (preview)' },
      checkpointId: null,
      checkpointAfterId: null,
      attempts: [{ strategy: 'fast', mode: fastMode, ok: true, result: fastResult }],
      profile: null,
      mode: fastMode,
      canRevert: false,
      fast: true
    };
  }

  var lineOpts = buildLineOpts(options);

  var checkpointId = createCheckpoint('text-pre-dedup', {
    type: 'text',
    input: txt,
    mode: options.mode,
    lineOpts: geckoDeepClone(lineOpts),
    output: null
  }, { silent: false });

  var profile = options.sniff !== false
    ? sniffFormat(options.path || '', txt)
    : { mode: options.mode || 'txt', confidence: 1, language: { id: 'generic' } };

  var attempts = [];
  var lastError = null;
  var finalResult = null;
  var finalVerification = null;
  var usedMode = options.mode || 'txt';

  for (var r = 0; r < GECKO_PIPELINE_MAX_RETRIES; r++) {
    var strategy = GECKO_RETRY_STRATEGIES[r] || GECKO_RETRY_STRATEGIES[GECKO_RETRY_STRATEGIES.length - 1];
    var ctx = {
      mode: resolveTextMode(txt, options.path, options.mode, options.autoDetect),
      lineOpts: geckoDeepClone(lineOpts),
      profile: profile
    };
    if (r > 0) ctx = strategy.adjust(ctx);
    usedMode = ctx.mode;

    var attempt = { strategy: strategy.name, mode: usedMode, note: ctx.note || '', ok: false };
    try {
      var result = invokeTextEngine(txt, usedMode, ctx.lineOpts);
      var verification = verifyTextResult(txt, result, usedMode, ctx.lineOpts);

      attempt.ok = true;
      attempt.verification = verification;
      attempt.result = result;
      attempts.push(attempt);

      if (verification.passed || r === GECKO_PIPELINE_MAX_RETRIES - 1) {
        finalResult = result;
        finalVerification = verification;
        break;
      }

      safeLog('Verification failed (' + strategy.name + '): ' + verification.summary + '. Retrying');
    } catch (e) {
      lastError = e;
      attempt.error = e.message;
      attempts.push(attempt);
      safeLog('Pipeline attempt failed (' + strategy.name + '): ' + e.message);
    }
  }

  if (!finalResult) {
    finalResult = { lines: [], total: 0, removed: 0, remaining: 0, error: lastError ? lastError.message : 'Pipeline failed' };
    finalVerification = { passed: false, checks: [], summary: 'All retries exhausted' };
  }

  createCheckpoint('text-post-dedup', {
    type: 'text',
    input: txt,
    output: finalResult.lines.join('\n'),
    mode: usedMode,
    lineOpts: lineOpts,
    checkpointBeforeId: checkpointId
  }, { silent: false });

  var run = {
    type: 'text',
    result: finalResult,
    verification: finalVerification,
    checkpointId: checkpointId,
    checkpointAfterId: getLastCheckpointId(),
    attempts: attempts,
    profile: profile,
    mode: usedMode,
    canRevert: true
  };

  GECKO_LAST_PIPELINE_RUN = run;
  safeLog('Pipeline [' + usedMode + ']: ' + finalVerification.summary +
    (attempts.length > 1 ? ' (' + attempts.length + ' attempts)' : ''));
  return run;
}

function runFolderPipeline(files, scopeOpts, lineOpts) {
  var snapshot = cloneFolderFiles(files);
  var checkpointId = createCheckpoint('folder-pre-dedup', {
    type: 'folder',
    files: snapshot,
    scopeOpts: geckoDeepClone(scopeOpts),
    lineOpts: geckoDeepClone(lineOpts)
  });

  var attempts = [];
  var finalResult = null;
  var finalVerification = null;
  var lastError = null;

  for (var r = 0; r < GECKO_PIPELINE_MAX_RETRIES; r++) {
    var strategy = GECKO_RETRY_STRATEGIES[r] || GECKO_RETRY_STRATEGIES[GECKO_RETRY_STRATEGIES.length - 1];
    var workFiles = geckoDeepClone(snapshot);
    var workScope = geckoDeepClone(scopeOpts);
    var workOpts = geckoDeepClone(lineOpts);

    if (r === 1) {
      workScope.dedupWithinCode = false;
      workScope.removeCodeBlocks = false;
    }
    if (r === 2) {
      workOpts.collapseWs = true;
      workOpts.ignorePunct = true;
      if (workOpts.simThreshold >= 1) workOpts.simThreshold = 0.92;
    }

    var attempt = { strategy: strategy.name, ok: false };
    try {
      var result = processFolderProject(workFiles, workScope, workOpts);
      var verification = verifyFolderResult(snapshot, result, workOpts);
      attempt.ok = true;
      attempt.verification = verification;
      attempt.result = result;
      attempts.push(attempt);

      if (verification.passed || r === GECKO_PIPELINE_MAX_RETRIES - 1) {
        finalResult = result;
        finalVerification = verification;
        break;
      }
      safeLog('Folder verification failed (' + strategy.name + '): ' + verification.summary + '. Retrying');
    } catch (e) {
      lastError = e;
      attempt.error = e.message;
      attempts.push(attempt);
    }
  }

  if (!finalResult) {
    finalResult = {
      files: snapshot,
      allFiles: snapshot,
      report: ['Pipeline failed: ' + (lastError ? lastError.message : 'unknown')],
      stats: { totalFiles: snapshot.length, keptFiles: snapshot.length, filesRemoved: 0, linesRemoved: 0, errors: 1 }
    };
    finalVerification = { passed: false, checks: [], summary: 'All retries exhausted' };
  }

  createCheckpoint('folder-post-dedup', {
    type: 'folder',
    files: cloneFolderFiles(finalResult.files),
    scopeOpts: scopeOpts,
    lineOpts: lineOpts,
    checkpointBeforeId: checkpointId
  });

  var run = {
    type: 'folder',
    result: finalResult,
    verification: finalVerification,
    checkpointId: checkpointId,
    checkpointAfterId: getLastCheckpointId(),
    attempts: attempts,
    canRevert: true
  };

  GECKO_LAST_PIPELINE_RUN = run;
  safeLog('Folder pipeline: ' + finalVerification.summary +
    (attempts.length > 1 ? ' (' + attempts.length + ' attempts)' : ''));
  return run;
}

function revertLastPipelineRun() {
  var cp = getCheckpoint(GECKO_LAST_PIPELINE_RUN ? GECKO_LAST_PIPELINE_RUN.checkpointId : null);
  if (!cp || !cp.payload) return null;
  safeLog('Reverted to checkpoint: ' + cp.label + ' [' + cp.id + ']');
  return geckoDeepClone(cp.payload);
}

function getLastPipelineRun() {
  return GECKO_LAST_PIPELINE_RUN;
}

function registerMediaPipelineRun(run) {
  GECKO_LAST_PIPELINE_RUN = run;
  return run;
}

function processLinesDirect(txt, mode, lineOpts) {
  return invokeTextEngine(txt, mode || 'txt', lineOpts);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runTextPipeline: runTextPipeline,
    runFolderPipeline: runFolderPipeline,
    revertLastPipelineRun: revertLastPipelineRun,
    getLastPipelineRun: getLastPipelineRun,
    registerMediaPipelineRun: registerMediaPipelineRun,
    processLinesDirect: processLinesDirect,
    invokeTextEngine: invokeTextEngine
  };
}
