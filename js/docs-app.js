// Geckodupe Docs tab: connected docs rail + docsify iframe
var DOCS_NAV = [
  { label: 'Home', hash: '#/' },
  { label: 'Quick start', hash: '#/quickstart' },
  { label: 'Get an API key', hash: '#/api-keys' },
  { label: 'Authentication', hash: '#/authentication' },
  { label: 'SDK (npm)', hash: '#/sdk' },
  { label: 'Spam API', hash: '#/spam-api' },
  { label: 'Events API', hash: '#/events-api' },
  { label: 'Blocklists', hash: '#/blocklists' },
  { label: 'Plans and limits', hash: '#/plans' },
  { label: 'Errors', hash: '#/errors' },
  { label: 'Security', hash: '#/security' },
  { label: 'Local browser tools', hash: '#/local-tools' },
  { label: 'Account and billing', hash: '#/account-billing' }
];

var docsNavReady = false;
var docsFrameReady = false;

function docsFrameUrl(hash) {
  var base = new URL('docs/index.html', location.href).href;
  var target = hash || '#/';
  if (target.charAt(0) !== '#') target = '#' + target;
  return base + target;
}

function docsSetActive(hash) {
  var current = hash || '#/';
  document.querySelectorAll('.docs-nav-btn').forEach(function (btn) {
    var active = btn.getAttribute('data-docs-hash') === current;
    btn.classList.toggle('current', active);
    btn.setAttribute('aria-current', active ? 'page' : 'false');
  });
}

function docsNavigate(hash) {
  var frame = document.getElementById('docs-frame');
  if (!frame) return;
  var target = hash || '#/';
  if (target.charAt(0) !== '#') target = '#' + target;
  frame.src = docsFrameUrl(target);
  docsFrameReady = true;
  docsSetActive(target);
}

function docsBuildNav() {
  var list = document.getElementById('docs-nav-list');
  if (!list || docsNavReady) return;
  list.innerHTML = '';
  DOCS_NAV.forEach(function (item) {
    var li = document.createElement('li');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'docs-nav-btn';
    btn.textContent = item.label;
    btn.setAttribute('data-docs-hash', item.hash);
    btn.onclick = function () {
      docsNavigate(item.hash);
    };
    li.appendChild(btn);
    list.appendChild(li);
  });
  docsNavReady = true;
  docsSetActive('#/');
}

function docsEnsureFrame() {
  var frame = document.getElementById('docs-frame');
  if (!frame) return;
  if (!docsFrameReady) {
    frame.src = docsFrameUrl('#/');
    docsFrameReady = true;
  }
}

function initDocsTab() {
  docsBuildNav();
  docsEnsureFrame();
  var shell = document.querySelector('.app-shell');
  if (shell) shell.classList.add('docs-mode');
  var aside = document.getElementById('docs-sidebar');
  if (aside) {
    aside.hidden = false;
    aside.setAttribute('aria-hidden', 'false');
  }
}

function teardownDocsTab() {
  var shell = document.querySelector('.app-shell');
  if (shell) shell.classList.remove('docs-mode');
  var aside = document.getElementById('docs-sidebar');
  if (aside) {
    aside.hidden = true;
    aside.setAttribute('aria-hidden', 'true');
  }
}
