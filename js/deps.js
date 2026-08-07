// Lazy-load heavy third-party libraries on demand
(function (global) {
  var LIBS = {
    papaparse: 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js',
    xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    d3: 'https://d3js.org/d3.v7.min.js',
    jszip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
  };

  var pending = {};

  function isLoaded(name) {
    if (name === 'papaparse') return typeof global.Papa !== 'undefined';
    if (name === 'xlsx') return typeof global.XLSX !== 'undefined';
    if (name === 'd3') return typeof global.d3 !== 'undefined';
    if (name === 'jszip') return typeof global.JSZip !== 'undefined';
    return false;
  }

  function loadScript(url) {
    if (pending[url]) return pending[url];
    pending[url] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Failed to load ' + url)); };
      document.head.appendChild(s);
    });
    return pending[url];
  }

  function ensureLib(name) {
    var url = LIBS[name];
    if (!url) return Promise.reject(new Error('Unknown library: ' + name));
    if (isLoaded(name)) return Promise.resolve();
    return loadScript(url);
  }

  function preloadLib(name) {
    ensureLib(name).catch(function () { /* optional preload */ });
  }

  function libsForFormat(mode) {
    if (mode === 'csv') return ['papaparse'];
    if (mode === 'excel') return ['xlsx'];
    return [];
  }

  function ensureLibsForFormat(mode) {
    return Promise.all(libsForFormat(mode).map(ensureLib));
  }

  global.ensureLib = ensureLib;
  global.preloadLib = preloadLib;
  global.ensureLibsForFormat = ensureLibsForFormat;

  var TAB_SCRIPTS = {
    '3': ['js/benchmark-data.js', 'js/info-stats.js'],
    '4': ['js/folder-app.js'],
    '5': ['js/media-app.js', 'js/media-preview.js'],
    '6': ['js/spam-app.js'],
    '7': ['js/api-app.js'],
    '8': ['js/pricing-app.js'],
    '9': ['js/account-app.js'],
    '10': ['js/docs-app.js']
  };
  var tabScriptLoads = {};

  function loadAppScript(src) {
    if (tabScriptLoads[src]) return tabScriptLoads[src];
    tabScriptLoads[src] = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-lazy-src="' + src + '"]');
      if (existing) {
        if (existing.dataset.loaded === 'true') return resolve();
        existing.addEventListener('load', function () { resolve(); }, { once: true });
        existing.addEventListener('error', function () { reject(new Error('Failed to load ' + src)); }, { once: true });
        return;
      }
      var s = document.createElement('script');
      s.src = src;
      s.defer = true;
      s.dataset.lazySrc = src;
      s.onload = function () {
        s.dataset.loaded = 'true';
        resolve();
      };
      s.onerror = function () { reject(new Error('Failed to load ' + src)); };
      document.body.appendChild(s);
    });
    return tabScriptLoads[src];
  }

  function ensureTabScripts(tabId) {
    var scripts = TAB_SCRIPTS[String(tabId)];
    if (!scripts || !scripts.length) return Promise.resolve();
    return Promise.all(scripts.map(loadAppScript));
  }

  global.ensureTabScripts = ensureTabScripts;

  function activateAsyncStylesheets() {
    document.querySelectorAll('link[data-async-css]').forEach(function (link) {
      link.media = 'all';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', activateAsyncStylesheets);
  } else {
    activateAsyncStylesheets();
  }
})(typeof window !== 'undefined' ? window : global);
