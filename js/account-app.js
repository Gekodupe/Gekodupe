// Geckodupe Account tab: sign-in, billing, profile
var GECKODUPE_API_BASE = 'https://geckodupe-spam.nic-58f.workers.dev';
var acctSession = '';
var acctEmail = '';

function acctStorageKey(name) {
  return 'geckodupe_api_' + name;
}

function acctLoadSession() {
  try {
    acctSession = localStorage.getItem(acctStorageKey('session')) || '';
    acctEmail = localStorage.getItem(acctStorageKey('email')) || '';
  } catch (e) {
    acctSession = '';
    acctEmail = '';
  }
}

function acctSaveSession(session, email) {
  acctSession = session || '';
  acctEmail = email || '';
  try {
    if (acctSession) {
      localStorage.setItem(acctStorageKey('session'), acctSession);
      localStorage.setItem(acctStorageKey('email'), acctEmail);
    } else {
      localStorage.removeItem(acctStorageKey('session'));
      localStorage.removeItem(acctStorageKey('email'));
    }
  } catch (e) { /* ignore */ }
  if (typeof quotaRefresh === 'function') quotaRefresh();
}

function acctSetStatus(msg) {
  var el = document.getElementById('acct-status-text');
  if (el) el.textContent = msg || '';
}

function acctShow(id, on) {
  var el = document.getElementById(id);
  if (el) el.style.display = on ? 'block' : 'none';
}

function acctRememberMe() {
  var el = document.getElementById('acct-remember');
  return el ? !!el.checked : true;
}

async function acctFetch(path, opts) {
  opts = opts || {};
  var headers = Object.assign({
    Accept: 'application/json',
    'Content-Type': 'application/json'
  }, opts.headers || {});
  if (acctSession) headers.Authorization = 'Bearer ' + acctSession;
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

function acctMode(mode) {
  acctShow('acct-mode-password', mode === 'password');
  acctShow('acct-mode-magic', mode === 'magic');
  acctShow('acct-mode-forgot', mode === 'forgot');
  acctShow('acct-mode-reset', mode === 'reset');
  acctShow('acct-code-panel', false);
}

function acctRenderSignedOut() {
  acctShow('acct-signed-out', true);
  acctShow('acct-signed-in', false);
  acctMode('password');
  acctSetStatus('');
}

function acctRenderSignedIn(account) {
  acctShow('acct-signed-out', false);
  acctShow('acct-signed-in', true);
  var emailEl = document.getElementById('acct-user-email');
  if (emailEl) emailEl.textContent = (account && account.email) || acctEmail || '';

  var planEl = document.getElementById('acct-user-plan');
  if (planEl) {
    var plan = (account && account.planName) || (account && account.plan) || 'Basic';
    var status = (account && account.planStatus) || 'active';
    var line = plan + ' · ' + status.replace(/_/g, ' ');
    if (account && account.emailVerified === false) line += ' · email not verified';
    planEl.textContent = line;
  }

  var usageEl = document.getElementById('acct-usage-line');
  if (usageEl && account && account.usage) {
    usageEl.textContent =
      (account.usage.apiUsedToday || 0).toLocaleString() +
      ' / ' +
      (account.usage.apiLimit || 0).toLocaleString() +
      ' API requests today · ' +
      (account.usage.keys || 0) +
      ' / ' +
      (account.usage.maxKeys || 0) +
      ' keys';
  }

  var verifyPanel = document.getElementById('acct-verify-panel');
  if (verifyPanel) {
    verifyPanel.style.display = account && account.emailVerified === false ? 'block' : 'none';
  }
}

async function acctRefreshAccount() {
  var account = await acctFetch('/v1/account');
  acctEmail = account.email || acctEmail;
  acctSaveSession(acctSession, acctEmail);
  acctRenderSignedIn(account);
  return account;
}

async function acctRegister() {
  var email = String((document.getElementById('acct-email') || {}).value || '').trim();
  var password = String((document.getElementById('acct-password') || {}).value || '');
  if (!email || !password) {
    if (typeof showToast === 'function') showToast('Email and password required', 'warning');
    return;
  }
  try {
    acctSetStatus('Creating account…');
    var res = await acctFetch('/v1/auth/register', {
      method: 'POST',
      body: { email: email, password: password, rememberMe: acctRememberMe() }
    });
    acctSaveSession(res.session, res.email);
    await acctRefreshAccount();
    acctSetStatus(res.message || 'Account created');
    if (typeof showToast === 'function') showToast('Account created — check email to verify', 'success');
  } catch (e) {
    acctSetStatus(e.message || 'Could not register');
    if (typeof showToast === 'function') showToast(e.message || 'Register failed', 'error');
  }
}

async function acctLogin() {
  var email = String((document.getElementById('acct-email') || {}).value || '').trim();
  var password = String((document.getElementById('acct-password') || {}).value || '');
  if (!email || !password) {
    if (typeof showToast === 'function') showToast('Email and password required', 'warning');
    return;
  }
  try {
    acctSetStatus('Signing in…');
    var res = await acctFetch('/v1/auth/login', {
      method: 'POST',
      body: { email: email, password: password, rememberMe: acctRememberMe() }
    });
    acctSaveSession(res.session, res.email);
    await acctRefreshAccount();
    acctSetStatus('Signed in as ' + res.email);
    if (typeof showToast === 'function') showToast('Signed in', 'success');
  } catch (e) {
    acctSetStatus(e.message || 'Sign-in failed');
    if (typeof showToast === 'function') showToast(e.message || 'Sign-in failed', 'error');
  }
}

async function acctStartSignIn() {
  var input = document.getElementById('acct-email-magic') || document.getElementById('acct-email');
  var email = input ? String(input.value || '').trim() : '';
  if (!email) {
    if (typeof showToast === 'function') showToast('Enter your email', 'warning');
    return;
  }
  try {
    acctSetStatus('Sending sign-in email…');
    var res = await acctFetch('/v1/auth/start', { method: 'POST', body: { email: email } });
    acctShow('acct-code-panel', true);
    var emailHint = document.getElementById('acct-email-hint');
    if (emailHint) emailHint.textContent = res.email || email;
    var codeEmail = document.getElementById('acct-code-email');
    if (codeEmail) codeEmail.value = res.email || email;
    acctSetStatus(res.message || 'Check your email.');
    if (typeof showToast === 'function') showToast('Sign-in email sent', 'success');
  } catch (e) {
    acctSetStatus(e.message || 'Could not send email');
    if (typeof showToast === 'function') showToast(e.message || 'Sign-in failed', 'error');
  }
}

async function acctForgot() {
  var email = String((document.getElementById('acct-forgot-email') || document.getElementById('acct-email') || {}).value || '').trim();
  if (!email) {
    if (typeof showToast === 'function') showToast('Enter your email', 'warning');
    return;
  }
  try {
    acctSetStatus('Sending reset link…');
    var res = await acctFetch('/v1/auth/forgot', { method: 'POST', body: { email: email } });
    acctSetStatus(res.message || 'Check your email');
    if (typeof showToast === 'function') showToast(res.message || 'Check your email', 'success');
  } catch (e) {
    acctSetStatus(e.message || 'Could not send reset');
    if (typeof showToast === 'function') showToast(e.message || 'Failed', 'error');
  }
}

async function acctResetPassword() {
  var token = (document.getElementById('acct-reset-token') || {}).value || '';
  var password = (document.getElementById('acct-reset-password') || {}).value || '';
  if (!token || !password) {
    if (typeof showToast === 'function') showToast('Password required', 'warning');
    return;
  }
  try {
    var res = await acctFetch('/v1/auth/reset', { method: 'POST', body: { token: token, password: password } });
    acctSetStatus(res.message || 'Password updated');
    if (typeof showToast === 'function') showToast('Password updated', 'success');
    acctMode('password');
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message || 'Reset failed', 'error');
  }
}

async function acctVerifyEmailToken(token) {
  try {
    await acctFetch('/v1/auth/verify-email', { method: 'POST', body: { token: token } });
    if (typeof showToast === 'function') showToast('Email verified', 'success');
    if (acctSession) await acctRefreshAccount();
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message || 'Verification failed', 'error');
  }
}

async function acctResendVerify() {
  try {
    var res = await acctFetch('/v1/auth/resend-verify', { method: 'POST', body: {} });
    if (typeof showToast === 'function') showToast(res.message || 'Verification email sent', 'success');
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message || 'Could not resend', 'error');
  }
}

async function acctVerify(tokenOrCode) {
  var codeEl = document.getElementById('acct-code');
  var emailEl = document.getElementById('acct-code-email') || document.getElementById('acct-email-magic') || document.getElementById('acct-email');
  var body = { rememberMe: acctRememberMe() };
  if (tokenOrCode && String(tokenOrCode).indexOf('mag_') === 0) {
    body.token = String(tokenOrCode);
  } else {
    body.code = tokenOrCode || (codeEl ? codeEl.value : '');
    body.email = emailEl ? emailEl.value : '';
  }
  try {
    acctSetStatus('Verifying…');
    var res = await acctFetch('/v1/auth/verify', { method: 'POST', body: body });
    acctSaveSession(res.session, res.email);
    await acctRefreshAccount();
    acctSetStatus('Signed in as ' + res.email);
    if (typeof showToast === 'function') showToast('Signed in', 'success');
    if (/[?&](auth|verify|reset)=/.test(location.hash)) {
      history.replaceState(null, '', location.pathname + location.search + '#account');
    }
  } catch (e) {
    acctSetStatus(e.message || 'Verification failed');
    if (typeof showToast === 'function') showToast(e.message || 'Invalid code', 'error');
  }
}

async function acctSignOut() {
  try {
    if (acctSession) await acctFetch('/v1/auth/logout', { method: 'POST', body: {} });
  } catch (e) { /* ignore */ }
  acctSaveSession('', '');
  acctRenderSignedOut();
  if (typeof showToast === 'function') showToast('Signed out', 'success');
}

async function acctOpenBilling() {
  try {
    var res = await acctFetch('/v1/billing/portal', { method: 'POST', body: {} });
    if (res.url) window.location.href = res.url;
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message || 'Billing portal unavailable', 'error');
  }
}

function acctGoApi() {
  if (typeof switchToTab === 'function') {
    location.hash = 'api';
    switchToTab('7');
  } else {
    location.hash = 'api';
  }
}

function acctHashParams() {
  var hash = location.hash || '';
  var q = hash.indexOf('?');
  if (q < 0) return new URLSearchParams();
  return new URLSearchParams(hash.slice(q + 1));
}

async function initAccountTab() {
  acctLoadSession();
  var params = acctHashParams();
  var authToken = params.get('auth');
  var verify = params.get('verify');
  var reset = params.get('reset');

  if (verify) {
    await acctVerifyEmailToken(verify);
    history.replaceState(null, '', location.pathname + location.search + '#account');
  }
  if (reset) {
    acctRenderSignedOut();
    acctMode('reset');
    var tok = document.getElementById('acct-reset-token');
    if (tok) tok.value = reset;
    return;
  }
  if (authToken) {
    await acctVerify(authToken);
    return;
  }
  if (acctSession) {
    try {
      await acctRefreshAccount();
      return;
    } catch (e) {
      acctSaveSession('', '');
    }
  }
  acctRenderSignedOut();
}

// Shared aliases so older CTAs / pricing still work if they call api* after rename
function apiMode(m) { if (typeof acctMode === 'function') acctMode(m); }
