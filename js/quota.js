// Geckodupe local quotas: guest soft caps + signed-in plan limits
(function (global) {
  var API_BASE = 'https://geckodupe-spam.nic-58f.workers.dev';

  var PLAN_LIMITS = {
    guest: {
      textMaxLines: 2000,
      textRunsPerDay: 5,
      folderMaxFiles: 40,
      mediaMaxFiles: 25,
      spamMaxLines: 1000,
      spamRunsPerDay: 5
    },
    free: {
      textMaxLines: 25000,
      textRunsPerDay: 50,
      folderMaxFiles: 500,
      mediaMaxFiles: 200,
      spamMaxLines: 20000,
      spamRunsPerDay: 50
    },
    starter: {
      textMaxLines: 100000,
      textRunsPerDay: 500,
      folderMaxFiles: 5000,
      mediaMaxFiles: 2000,
      spamMaxLines: 100000,
      spamRunsPerDay: 500
    },
    pro: {
      textMaxLines: 500000,
      textRunsPerDay: 5000,
      folderMaxFiles: 25000,
      mediaMaxFiles: 10000,
      spamMaxLines: 500000,
      spamRunsPerDay: 5000
    },
    business: {
      textMaxLines: 2000000,
      textRunsPerDay: 50000,
      folderMaxFiles: 100000,
      mediaMaxFiles: 50000,
      spamMaxLines: 2000000,
      spamRunsPerDay: 50000
    }
  };

  var state = {
    plan: 'guest',
    email: '',
    limits: PLAN_LIMITS.guest,
    ready: false
  };

  function dayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function storageGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function storageSet(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { /* ignore */ }
  }

  function usageBucket() {
    var key = 'geckodupe_quota_' + dayKey();
    var data = storageGet(key, null);
    if (!data || data.day !== dayKey()) {
      data = { day: dayKey(), text: 0, folder: 0, media: 0, spam: 0 };
      storageSet(key, data);
    }
    return { key: key, data: data };
  }

  function sessionToken() {
    try {
      return localStorage.getItem('geckodupe_api_session') || '';
    } catch (e) {
      return '';
    }
  }

  function applyPlan(plan, limits) {
    var id = plan && PLAN_LIMITS[plan] ? plan : 'guest';
    state.plan = id;
    state.limits = limits && typeof limits === 'object'
      ? Object.assign({}, PLAN_LIMITS[id], limits)
      : PLAN_LIMITS[id];
  }

  async function quotaRefresh() {
    var token = sessionToken();
    if (!token) {
      state.email = '';
      applyPlan('guest');
      state.ready = true;
      quotaRenderBanners();
      return state;
    }
    try {
      var res = await fetch(API_BASE + '/v1/auth/me', {
        headers: { Accept: 'application/json', Authorization: 'Bearer ' + token }
      });
      if (!res.ok) throw new Error('session');
      var data = await res.json();
      state.email = data.email || '';
      applyPlan(data.plan || 'free', data.limits);
    } catch (e) {
      state.email = '';
      applyPlan('guest');
    }
    state.ready = true;
    quotaRenderBanners();
    return state;
  }

  function goSignIn() {
    if (typeof switchToTab === 'function') {
      location.hash = 'account';
      switchToTab('9');
    } else {
      location.hash = 'account';
    }
  }

  function goPricing() {
    if (typeof switchToTab === 'function') {
      location.hash = 'pricing';
      switchToTab('8');
    } else {
      location.hash = 'pricing';
    }
  }

  function planLabel(plan) {
    var map = { free: 'Basic', starter: 'Starter', pro: 'Pro', business: 'Business', guest: 'Guest' };
    return map[plan] || (plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : 'Guest');
  }

  function gateMessage(tool, detail) {
    var signed = !!state.email;
    if (!signed) {
      return detail + ' Sign in for higher limits, or upgrade on Pricing.';
    }
    return detail + ' Upgrade on Pricing for more capacity.';
  }

  function showGate(detail) {
    if (typeof showToast === 'function') showToast(detail, 'warning');
    var el = document.getElementById('quota-gate-banner');
    if (!el) return;
    el.hidden = false;
    var msg = el.querySelector('[data-quota-msg]');
    if (msg) msg.textContent = detail;
  }

  function checkLines(tool, lines) {
    var lim = state.limits;
    var max = tool === 'spam' ? lim.spamMaxLines : lim.textMaxLines;
    var runsKey = tool === 'spam' ? 'spam' : 'text';
    var runsMax = tool === 'spam' ? lim.spamRunsPerDay : lim.textRunsPerDay;
    var usage = usageBucket().data;
    var label = planLabel(state.plan);
    if (lines > max) {
      return {
        ok: false,
        message: gateMessage(
          tool,
          'This ' + tool + ' run is over your ' + label + ' limit (' + max.toLocaleString() + ' lines).'
        )
      };
    }
    if (usage[runsKey] >= runsMax) {
      return {
        ok: false,
        message: gateMessage(
          tool,
          'Daily ' + tool + ' run limit reached (' + runsMax + '/day on ' + label + ').'
        )
      };
    }
    return { ok: true };
  }

  function checkFiles(tool, count) {
    var lim = state.limits;
    var max = tool === 'media' ? lim.mediaMaxFiles : lim.folderMaxFiles;
    var label = planLabel(state.plan);
    if (count > max) {
      return {
        ok: false,
        message: gateMessage(
          tool,
          'Too many files for ' + label + ' (' + max.toLocaleString() + ' max).'
        )
      };
    }
    return { ok: true };
  }

  function consume(tool) {
    var bucket = usageBucket();
    if (tool === 'text' || tool === 'spam' || tool === 'folder' || tool === 'media') {
      bucket.data[tool] = (bucket.data[tool] || 0) + 1;
      storageSet(bucket.key, bucket.data);
    }
    quotaRenderBanners();
  }

  function allowText(lines) {
    var r = checkLines('text', lines);
    if (!r.ok) {
      showGate(r.message);
      return false;
    }
    return true;
  }

  function allowSpam(lines) {
    var r = checkLines('spam', lines);
    if (!r.ok) {
      showGate(r.message);
      return false;
    }
    return true;
  }

  function allowFolder(count) {
    var r = checkFiles('folder', count);
    if (!r.ok) {
      showGate(r.message);
      return false;
    }
    return true;
  }

  function allowMedia(count) {
    var r = checkFiles('media', count);
    if (!r.ok) {
      showGate(r.message);
      return false;
    }
    return true;
  }

  function quotaRenderBanners() {
    document.querySelectorAll('[data-quota-banner]').forEach(function (el) {
      var tool = el.getAttribute('data-quota-banner');
      var lim = state.limits;
      var usage = usageBucket().data;
      var label = '';
      if (state.plan === 'guest') {
        if (tool === 'text') label = 'Guest · ' + lim.textMaxLines.toLocaleString() + ' lines · ' + usage.text + '/' + lim.textRunsPerDay + ' runs today';
        if (tool === 'folder') label = 'Guest · up to ' + lim.folderMaxFiles + ' files';
        if (tool === 'media') label = 'Guest · up to ' + lim.mediaMaxFiles + ' files';
        if (tool === 'spam') label = 'Guest · ' + lim.spamMaxLines.toLocaleString() + ' lines · ' + usage.spam + '/' + lim.spamRunsPerDay + ' runs today';
      } else {
        label = planLabel(state.plan) + ' · local tools unlocked';
      }
      var textEl = el.querySelector('[data-quota-label]');
      if (textEl) textEl.textContent = label;
      el.hidden = false;
    });
  }

  global.quotaRefresh = quotaRefresh;
  global.quotaAllowText = allowText;
  global.quotaAllowSpam = allowSpam;
  global.quotaAllowFolder = allowFolder;
  global.quotaAllowMedia = allowMedia;
  global.quotaConsume = consume;
  global.quotaGoSignIn = goSignIn;
  global.quotaGoPricing = goPricing;
  global.quotaState = function () { return state; };
  global.quotaRenderBanners = quotaRenderBanners;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { quotaRefresh(); });
  } else {
    quotaRefresh();
  }
})(typeof window !== 'undefined' ? window : this);
