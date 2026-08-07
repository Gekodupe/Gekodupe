// Geckodupe Spam tab: local despam only (edge prevention lives on the future Api page)

var spamLastCleaned = '';
var SPAM_MAX_CHARS = 5 * 1024 * 1024;
var SPAM_WARN_LINES = 20000;

function spamReadOpts() {
  var modeEl = document.getElementById('spam-mode');
  var simEl = document.getElementById('spam-similarity');
  var blockEl = document.getElementById('spam-blocklist');
  var sim = simEl ? (Number(simEl.value) / 100) : 0.85;
  if (!isFinite(sim) || sim < 0.5) sim = 0.85;
  if (sim > 1) sim = 1;
  return {
    mode: modeEl ? modeEl.value : 'form',
    detectHoneypot: !!(document.getElementById('spam-detect-honeypot') || {}).checked,
    detectUrlFlood: !!(document.getElementById('spam-detect-url-flood') || {}).checked,
    detectDisposable: !!(document.getElementById('spam-detect-disposable') || {}).checked,
    detectBait: !!(document.getElementById('spam-detect-bait') || {}).checked,
    stripTrackers: !!(document.getElementById('spam-strip-trackers') || {}).checked,
    simThreshold: sim,
    blocklist: blockEl ? blockEl.value : ''
  };
}

function spamUpdateSimLabel() {
  var simEl = document.getElementById('spam-similarity');
  var label = document.getElementById('spam-sim-val');
  if (simEl && label) label.textContent = simEl.value + '%';
}

function spamSetStatus(msg) {
  var el = document.getElementById('spam-status-text');
  if (el) el.textContent = msg || '';
}

function spamRenderScore(score) {
  var meter = document.getElementById('spam-score-meter');
  var chips = document.getElementById('spam-reason-chips');
  if (!score) {
    if (meter) meter.textContent = '';
    if (chips) chips.innerHTML = '';
    return;
  }
  if (meter) {
    var pct = Math.round((Number(score.score) || 0) * 100);
    meter.textContent = pct + '% · ' + (score.decision || 'allow');
    meter.style.color = score.decision === 'block' ? '#b91c1c'
      : score.decision === 'soft_reject' ? '#d96c10' : '#1a1a1a';
  }
  if (chips) {
    chips.innerHTML = '';
    var reasons = score.reasons || [];
    if (!reasons.length) reasons = ['clean'];
    reasons.forEach(function (reason) {
      var span = document.createElement('span');
      span.textContent = reason;
      span.style.cssText = 'border:1px solid #e5e7eb;padding:4px 10px;font-size:12px;color:#484848;';
      chips.appendChild(span);
    });
  }
}

function spamShowOutput(cleaned, score, statusMsg) {
  var box = document.getElementById('spam-output-container');
  var out = document.getElementById('spam-output');
  if (box) box.style.display = 'block';
  if (out) out.value = cleaned == null ? '' : cleaned;
  spamLastCleaned = out ? out.value : '';
  spamRenderScore(score);
  spamSetStatus(statusMsg || '');
}

function spamMarkStale() {
  if (!spamLastCleaned && !(document.getElementById('spam-output') || {}).value) return;
  spamSetStatus('Options changed. Run Despam again for an updated verdict.');
}

function despamLocal() {
  var input = document.getElementById('spam-input');
  var txt = input ? input.value : '';
  if (!txt.trim()) {
    if (typeof showToast === 'function') showToast('Paste something to despam', 'warning');
    return;
  }
  if (txt.length > SPAM_MAX_CHARS) {
    if (typeof showToast === 'function') {
      showToast('Input is too large (max ~5 MB). Split it and try again.', 'warning');
    }
    return;
  }
  var lineCount = txt.split('\n').length;
  if (typeof quotaAllowSpam === 'function' && !quotaAllowSpam(lineCount)) {
    return;
  }
  if (typeof quotaConsume === 'function') quotaConsume('spam');
  if (lineCount > SPAM_WARN_LINES && typeof showToast === 'function') {
    showToast('Large list (' + lineCount + ' lines). Near-duplicate soft matching may be limited for speed.', 'warning');
  }
  if (typeof runSpamPipeline !== 'function') {
    if (typeof showToast === 'function') showToast('Spam engine not loaded', 'warning');
    return;
  }

  try {
    spamSetStatus('Despamming...');
    var run = runSpamPipeline(txt, spamReadOpts());
    if (run.result && run.result.parseError === 'invalid_json') {
      spamShowOutput(
        '',
        run.score,
        'Invalid JSON form. Fix braces or switch Mode to Line list / Log scrub.'
      );
      if (typeof showToast === 'function') showToast('Invalid JSON form payload', 'warning');
      return;
    }
    if (run.result && run.result.error) {
      spamShowOutput('', run.score, 'Error: ' + run.result.error);
      if (typeof showToast === 'function') showToast('Despam failed', 'error');
      return;
    }
    var cleaned = run.result ? run.result.cleaned : '';
    var removed = run.result ? run.result.removedCount : 0;
    var kept = run.result ? run.result.keptCount : 0;
    var decision = (run.score && run.score.decision) || 'allow';
    var note = '';
    if (run.result && run.result.softMatchSkipped) {
      note = ' Exact matches only (list too large for soft near-dupes).';
    }
    spamShowOutput(
      cleaned,
      run.score,
      'Kept ' + kept + ', removed ' + removed + ', verdict ' + decision + '.' + note
    );
    if (typeof showToast === 'function') showToast('Despam complete', 'success');
  } catch (e) {
    spamSetStatus('Error: ' + (e && e.message ? e.message : String(e)));
    if (typeof showToast === 'function') showToast('Despam failed', 'error');
  }
}

function clearSpam() {
  var input = document.getElementById('spam-input');
  var out = document.getElementById('spam-output');
  var box = document.getElementById('spam-output-container');
  if (input) input.value = '';
  if (out) out.value = '';
  if (box) box.style.display = 'none';
  spamLastCleaned = '';
  spamRenderScore(null);
  spamSetStatus('');
}

function copySpamOutput() {
  var out = document.getElementById('spam-output');
  var val = out ? out.value : '';
  if (!val) {
    if (typeof showToast === 'function') showToast('Nothing to copy', 'warning');
    return;
  }
  function done() {
    if (typeof showToast === 'function') showToast('Copied', 'success');
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(val).then(done).catch(function () {
      out.focus();
      out.select();
      document.execCommand('copy');
      done();
    });
  } else {
    out.focus();
    out.select();
    document.execCommand('copy');
    done();
  }
}

function sendSpamToTextTab() {
  var val = spamLastCleaned || (document.getElementById('spam-output') || {}).value || '';
  if (!val) {
    if (typeof showToast === 'function') showToast('Nothing to send', 'warning');
    return;
  }
  var master = document.getElementById('masterlist');
  if (!master) return;
  master.value = val;
  if (typeof switchToTab === 'function') switchToTab('1');
  else {
    var btn = document.getElementById('t-1');
    if (btn) btn.click();
  }
  if (typeof showToast === 'function') showToast('Sent to Text Data', 'success');
}

function initSpamTab() {
  spamUpdateSimLabel();
  var sim = document.getElementById('spam-similarity');
  if (sim && !sim._spamBound) {
    sim.addEventListener('input', spamUpdateSimLabel);
    sim.addEventListener('change', spamMarkStale);
    sim._spamBound = true;
  }
  var mode = document.getElementById('spam-mode');
  if (mode && !mode._spamBound) {
    mode.addEventListener('change', spamMarkStale);
    mode._spamBound = true;
  }
  ['spam-detect-honeypot', 'spam-detect-url-flood', 'spam-detect-disposable', 'spam-detect-bait', 'spam-strip-trackers'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el && !el._spamBound) {
      el.addEventListener('change', spamMarkStale);
      el._spamBound = true;
    }
  });
}
