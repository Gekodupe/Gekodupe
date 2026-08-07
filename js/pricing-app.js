// Geckodupe Pricing tab
var GECKODUPE_BILLING_BASE = 'https://geckodupe-spam.nic-58f.workers.dev';

function pricingSession() {
  try {
    return localStorage.getItem('geckodupe_api_session') || '';
  } catch (e) {
    return '';
  }
}

async function pricingFetch(path, opts) {
  opts = opts || {};
  var headers = Object.assign({
    Accept: 'application/json',
    'Content-Type': 'application/json'
  }, opts.headers || {});
  var session = pricingSession();
  if (session) headers.Authorization = 'Bearer ' + session;
  var res = await fetch(GECKODUPE_BILLING_BASE + path, {
    method: opts.method || 'GET',
    headers: headers,
    body: opts.body != null ? JSON.stringify(opts.body) : undefined
  });
  var data = null;
  try { data = await res.json(); } catch (e) { data = { error: 'Invalid response' }; }
  if (!res.ok) {
    var err = new Error((data && data.error) || ('Request failed (' + res.status + ')'));
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

function pricingFmtMoney(n) {
  if (n == null || n === 0) return '$0';
  return '$' + n;
}

function pricingRenderPlans(payload) {
  var grid = document.getElementById('pricing-grid');
  if (!grid) return;
  var plans = (payload && payload.plans) || [];
  grid.innerHTML = '';

  plans.forEach(function (p) {
    var card = document.createElement('article');
    card.className = 'pricing-card';
    var cta = '';
    if (p.id === 'free') {
      cta = '<button type="button" onclick="pricingCheckout(\'free\')">Get Basic</button>';
    } else {
      cta = '<button type="button" onclick="pricingCheckout(\'' + p.id + '\')">Upgrade</button>';
    }
    var feats = (p.features || []).map(function (f) { return '<li>' + f + '</li>'; }).join('');
    card.innerHTML =
      '<p class="pricing-card-name">' + p.name + '</p>' +
      '<p class="pricing-card-price">' + pricingFmtMoney(p.priceMonthly) +
      '<span class="pricing-card-period">/mo</span></p>' +
      '<p class="pricing-card-blurb">' + (p.blurb || '') + '</p>' +
      '<ul class="pricing-card-features">' + feats + '</ul>' +
      cta;
    grid.appendChild(card);
  });
}

async function pricingCheckout(plan) {
  if (!pricingSession()) {
    if (typeof showToast === 'function') showToast('Sign in on Account first to upgrade', 'warning');
    if (typeof quotaGoSignIn === 'function') quotaGoSignIn();
    return;
  }
  try {
    if (typeof showToast === 'function') showToast('Opening secure checkout...', 'warning');
    var res = await pricingFetch('/v1/billing/checkout', { method: 'POST', body: { plan: plan } });
    if (res.url) {
      window.location.href = res.url;
      return;
    }
    throw new Error('No checkout URL');
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message || 'Checkout failed', 'error');
  }
}

async function pricingOpenPortal() {
  if (!pricingSession()) {
    if (typeof showToast === 'function') showToast('Sign in on Account to manage billing', 'warning');
    if (typeof quotaGoSignIn === 'function') quotaGoSignIn();
    return;
  }
  try {
    var res = await pricingFetch('/v1/billing/portal', { method: 'POST', body: {} });
    if (res.url) window.location.href = res.url;
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message || 'Portal unavailable', 'error');
  }
}

function pricingConsumeHash() {
  var hash = location.hash || '';
  var q = hash.indexOf('?');
  if (q < 0) return;
  var params = new URLSearchParams(hash.slice(q + 1));
  var checkout = params.get('checkout');
  if (checkout === 'success') {
    if (typeof showToast === 'function') showToast('Subscription active. Thank you!', 'success');
    history.replaceState(null, '', location.pathname + location.search + '#pricing');
    if (typeof quotaRefresh === 'function') quotaRefresh();
  } else if (checkout === 'cancel') {
    if (typeof showToast === 'function') showToast('Checkout cancelled', 'warning');
    history.replaceState(null, '', location.pathname + location.search + '#pricing');
  }
}

async function initPricingTab() {
  pricingConsumeHash();
  try {
    var data = await pricingFetch('/v1/billing/plans');
    pricingRenderPlans(data);
  } catch (e) {
    var grid = document.getElementById('pricing-grid');
    if (grid) {
      grid.innerHTML = '<p class="pricing-fineprint">Could not load plans. Try again shortly.</p>';
    }
  }
  var portalBtn = document.getElementById('pricing-portal-btn');
  if (portalBtn) {
    portalBtn.style.display = pricingSession() ? 'inline-flex' : 'none';
  }
}
