// Geckodupe API tab: keys + d3 usage visuals (auth lives on Account)
var GECKODUPE_API_BASE = 'https://geckodupe-spam.nic-58f.workers.dev';
var apiSession = '';
var apiEmail = '';
var apiLastAccount = null;

var API_CHART_COLORS = {
  primary: '#f7831e',
  secondary: '#D96C10',
  track: 'rgba(92,90,96,0.18)',
  text: '#5C5A60',
  grid: 'rgba(92,90,96,0.10)'
};

function apiStorageKey(name) {
  return 'geckodupe_api_' + name;
}

function apiLoadSession() {
  try {
    apiSession = localStorage.getItem(apiStorageKey('session')) || '';
    apiEmail = localStorage.getItem(apiStorageKey('email')) || '';
  } catch (e) {
    apiSession = '';
    apiEmail = '';
  }
}

function apiSaveSession(session, email) {
  apiSession = session || '';
  apiEmail = email || '';
  try {
    if (apiSession) {
      localStorage.setItem(apiStorageKey('session'), apiSession);
      localStorage.setItem(apiStorageKey('email'), apiEmail);
    } else {
      localStorage.removeItem(apiStorageKey('session'));
      localStorage.removeItem(apiStorageKey('email'));
    }
  } catch (e) { /* ignore */ }
  if (typeof quotaRefresh === 'function') quotaRefresh();
}

function apiSetStatus(msg) {
  var el = document.getElementById('api-status-text');
  if (el) el.textContent = msg || '';
}

function apiShow(id, on) {
  var el = document.getElementById(id);
  if (el) el.style.display = on ? 'block' : 'none';
}

async function apiFetch(path, opts) {
  opts = opts || {};
  var headers = Object.assign({
    Accept: 'application/json',
    'Content-Type': 'application/json'
  }, opts.headers || {});
  if (apiSession) headers.Authorization = 'Bearer ' + apiSession;
  var res = await fetch(GECKODUPE_API_BASE + path, {
    method: opts.method || 'GET',
    headers: headers,
    body: opts.body != null ? JSON.stringify(opts.body) : undefined
  });
  var data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = { error: 'Invalid response' };
  }
  if (!res.ok) {
    var err = new Error((data && (data.error || data.message)) || ('Request failed (' + res.status + ')'));
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

function apiGoAccount() {
  if (typeof switchToTab === 'function') {
    location.hash = 'account';
    switchToTab('9');
  } else {
    location.hash = 'account';
  }
}

function apiRenderSignedOut() {
  apiShow('api-gate', true);
  apiShow('api-workspace', false);
  apiSetStatus('');
  apiClearCharts();
}

function apiRenderSignedIn(account) {
  apiLastAccount = account;
  apiShow('api-gate', false);
  apiShow('api-workspace', true);

  var emailEl = document.getElementById('api-user-email');
  if (emailEl) emailEl.textContent = (account && account.email) || apiEmail || '';

  var planEl = document.getElementById('api-user-plan');
  if (planEl) {
    var plan = (account && account.planName) || (account && account.plan) || 'Free';
    var usage = account && account.usage;
    var line = plan;
    if (usage) {
      line += ' · ' + (usage.apiUsedToday || 0).toLocaleString() + ' / ' + (usage.apiLimit || 0).toLocaleString() + ' today';
    }
    if (account && account.emailVerified === false) line += ' · verify email to create keys';
    planEl.textContent = line;
  }

  apiRenderKeyList(account);
  apiRenderUsageCharts(account);
}

function apiRenderKeyList(account) {
  var list = document.getElementById('api-key-list');
  if (!list) return;
  list.innerHTML = '';
  var keys = (account && account.keys) || [];
  if (!keys.length) {
    list.innerHTML = '<p style="color:#484848;font-size:14px;">No keys yet. Create one to call Geckodupe from your server.</p>';
    return;
  }
  keys.forEach(function (k) {
    var row = document.createElement('div');
    row.className = 'options-row';
    row.style.cssText = 'justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap;';
    row.innerHTML =
      '<div><strong style="font-weight:500;">' + (k.label || 'Default') + '</strong>' +
      '<div style="font-size:13px;color:#484848;margin-top:2px;">' + (k.prefix || '') + '</div></div>';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'secondary-btn';
    btn.textContent = 'Revoke';
    btn.onclick = function () { apiRevokeKey(k.id); };
    row.appendChild(btn);
    list.appendChild(row);
  });
}

function apiClearCharts() {
  ['api-chart-today', 'api-chart-week'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
}

function apiChartWidth(el) {
  var parent = el.parentElement;
  return Math.max((parent ? parent.clientWidth : 320) - 16, 200);
}

function apiRenderUsageCharts(account) {
  var usage = (account && account.usage) || {};
  var used = usage.apiUsedToday || 0;
  var limit = usage.apiLimit || 1;
  var history = usage.history || [];

  var todayEl = document.getElementById('api-chart-today');
  var weekEl = document.getElementById('api-chart-week');
  var todayLabel = document.getElementById('api-usage-today-label');
  var weekLabel = document.getElementById('api-usage-week-label');

  if (todayLabel) {
    todayLabel.textContent = used.toLocaleString() + ' of ' + limit.toLocaleString() + ' requests today';
  }
  if (weekLabel) {
    var weekTotal = history.reduce(function (s, d) { return s + (d.used || 0); }, 0);
    weekLabel.textContent = weekTotal.toLocaleString() + ' requests over 7 days';
  }

  if (typeof d3 === 'undefined') {
    if (typeof ensureLib === 'function') {
      ensureLib('d3').then(function () { apiRenderUsageCharts(account); }).catch(function () {});
    }
    return;
  }

  apiDrawTodayBar(todayEl, used, limit);
  apiDrawWeekChart(weekEl, history, limit);
}

function apiDrawTodayBar(el, used, limit) {
  if (!el) return;
  el.innerHTML = '';
  var width = apiChartWidth(el);
  var height = 56;
  var margin = { top: 8, right: 8, bottom: 8, left: 8 };
  var innerW = width - margin.left - margin.right;
  var pct = Math.min(1, limit > 0 ? used / limit : 0);

  var svg = d3.select(el).append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('class', 'chart-svg api-usage-svg');

  var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

  g.append('rect')
    .attr('x', 0)
    .attr('y', 14)
    .attr('width', innerW)
    .attr('height', 18)
    .attr('rx', 2)
    .attr('fill', API_CHART_COLORS.track);

  g.append('rect')
    .attr('x', 0)
    .attr('y', 14)
    .attr('width', Math.max(2, innerW * pct))
    .attr('height', 18)
    .attr('rx', 2)
    .attr('fill', API_CHART_COLORS.primary);

  g.append('text')
    .attr('x', 0)
    .attr('y', 10)
    .attr('fill', API_CHART_COLORS.text)
    .attr('font-size', 12)
    .text(Math.round(pct * 100) + '% of daily quota');
}

function apiDrawWeekChart(el, history, limit) {
  if (!el) return;
  el.innerHTML = '';
  var data = (history && history.length)
    ? history
    : [{ day: new Date().toISOString().slice(0, 10), used: 0 }];

  var width = apiChartWidth(el);
  var height = 180;
  var margin = { top: 12, right: 12, bottom: 28, left: 40 };
  var innerW = width - margin.left - margin.right;
  var innerH = height - margin.top - margin.bottom;

  var svg = d3.select(el).append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('class', 'chart-svg api-usage-svg');

  var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

  var x = d3.scalePoint()
    .domain(data.map(function (d) { return d.day.slice(5); }))
    .range([0, innerW])
    .padding(0.4);

  var yMax = Math.max(limit || 1, d3.max(data, function (d) { return d.used; }) || 1) * 1.1;
  var y = d3.scaleLinear().domain([0, yMax]).range([innerH, 0]);

  g.append('g')
    .attr('class', 'chart-axis chart-axis-x')
    .attr('transform', 'translate(0,' + innerH + ')')
    .call(d3.axisBottom(x).tickSize(0).tickPadding(8));

  g.append('g')
    .attr('class', 'chart-axis chart-axis-y')
    .call(d3.axisLeft(y).ticks(4).tickSize(-innerW).tickPadding(6).tickFormat(d3.format('~s')));

  g.selectAll('.chart-axis-y .tick line').attr('stroke', API_CHART_COLORS.grid);
  g.selectAll('.domain').attr('stroke', 'transparent');
  g.selectAll('text').attr('fill', API_CHART_COLORS.text).attr('font-size', 11);

  if (limit > 0) {
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', y(limit))
      .attr('y2', y(limit))
      .attr('stroke', API_CHART_COLORS.secondary)
      .attr('stroke-dasharray', '4 4')
      .attr('stroke-opacity', 0.7);
  }

  var area = d3.area()
    .curve(d3.curveMonotoneX)
    .x(function (d) { return x(d.day.slice(5)); })
    .y0(innerH)
    .y1(function (d) { return y(d.used); });

  var line = d3.line()
    .curve(d3.curveMonotoneX)
    .x(function (d) { return x(d.day.slice(5)); })
    .y(function (d) { return y(d.used); });

  g.append('path')
    .datum(data)
    .attr('fill', 'rgba(247,131,30,0.18)')
    .attr('d', area);

  g.append('path')
    .datum(data)
    .attr('fill', 'none')
    .attr('stroke', API_CHART_COLORS.primary)
    .attr('stroke-width', 2)
    .attr('d', line);

  g.selectAll('.api-usage-dot')
    .data(data)
    .enter()
    .append('circle')
    .attr('class', 'api-usage-dot')
    .attr('cx', function (d) { return x(d.day.slice(5)); })
    .attr('cy', function (d) { return y(d.used); })
    .attr('r', 3.5)
    .attr('fill', API_CHART_COLORS.primary);
}

async function apiRefreshAccount() {
  var account = await apiFetch('/v1/account');
  apiEmail = account.email || apiEmail;
  apiSaveSession(apiSession, apiEmail);
  apiRenderSignedIn(account);
  return account;
}

async function apiCreateKey() {
  var labelEl = document.getElementById('api-key-label');
  var label = labelEl ? labelEl.value.trim() : 'Default';
  try {
    apiSetStatus('Creating key…');
    var res = await apiFetch('/v1/account/keys', {
      method: 'POST',
      body: { label: label || 'Default' }
    });
    var box = document.getElementById('api-new-key-panel');
    var out = document.getElementById('api-new-key-value');
    var envOut = document.getElementById('api-env-example');
    if (box) box.style.display = 'block';
    if (out) out.value = res.apiKey || (res.key && res.key.secret) || '';
    if (envOut) envOut.value = res.envExample || ('GECKODUPE_API_KEY=' + (out ? out.value : ''));
    if (labelEl) labelEl.value = '';
    await apiRefreshAccount();
    apiSetStatus(res.warning || 'Key created. Copy it now.');
    if (typeof showToast === 'function') showToast('API key created', 'success');
  } catch (e) {
    apiSetStatus(e.message || 'Could not create key');
    if (typeof showToast === 'function') showToast(e.message || 'Create failed', 'error');
  }
}

async function apiRevokeKey(id) {
  if (!id) return;
  if (!window.confirm('Revoke this API key? Apps using it will stop working.')) return;
  try {
    await apiFetch('/v1/account/keys/' + encodeURIComponent(id), { method: 'DELETE' });
    await apiRefreshAccount();
    if (typeof showToast === 'function') showToast('Key revoked', 'success');
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message || 'Revoke failed', 'error');
  }
}

function apiCopy(elId) {
  var el = document.getElementById(elId);
  var val = el ? el.value : '';
  if (!val) {
    if (typeof showToast === 'function') showToast('Nothing to copy', 'warning');
    return;
  }
  function done() {
    if (typeof showToast === 'function') showToast('Copied', 'success');
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(val).then(done).catch(function () {
      el.focus();
      el.select();
      document.execCommand('copy');
      done();
    });
  } else {
    el.focus();
    el.select();
    document.execCommand('copy');
    done();
  }
}

function apiHashParams() {
  var hash = location.hash || '';
  var q = hash.indexOf('?');
  if (q < 0) return new URLSearchParams();
  return new URLSearchParams(hash.slice(q + 1));
}

async function initApiTab() {
  apiLoadSession();

  // Legacy auth links on #api → Account
  var params = apiHashParams();
  if (params.get('auth') || params.get('verify') || params.get('reset')) {
    var q = location.hash.indexOf('?');
    var qs = q >= 0 ? location.hash.slice(q) : '';
    location.hash = 'account' + qs;
    if (typeof switchToTab === 'function') switchToTab('9');
    return;
  }

  if (!apiSession) {
    apiRenderSignedOut();
    return;
  }

  try {
    if (typeof ensureLib === 'function') await ensureLib('d3');
  } catch (e) { /* charts optional */ }

  try {
    await apiRefreshAccount();
  } catch (e) {
    apiSaveSession('', '');
    apiRenderSignedOut();
  }
}
