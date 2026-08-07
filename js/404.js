(function () {
  'use strict';

  var DURATION_MS = 3500;
  var TICK_MS = 50;
  var HOME = new URL('./#text-file', location.href).href;

  var bar = document.getElementById('nf-bar');
  var progressEl = document.querySelector('.nf-progress');
  var secondsEl = document.getElementById('nf-seconds');
  var homeLink = document.getElementById('nf-home');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (homeLink) homeLink.setAttribute('href', HOME);

  var brandLink = document.getElementById('nf-brand');
  if (brandLink) brandLink.setAttribute('href', HOME);

  var redirected = false;

  function goHome() {
    if (redirected) return;
    redirected = true;
    window.location.replace(HOME);
  }

  if (reducedMotion) {
    if (bar) bar.style.width = '100%';
    if (progressEl) progressEl.setAttribute('aria-valuenow', '100');
    if (secondsEl) secondsEl.textContent = '1';
    window.setTimeout(goHome, 800);
    return;
  }

  var start = Date.now();

  function tick() {
    if (redirected) return;

    var elapsed = Date.now() - start;
    var progress = Math.min(elapsed / DURATION_MS, 1);

    if (bar) bar.style.width = (progress * 100).toFixed(1) + '%';
    if (progressEl) progressEl.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
    if (secondsEl) {
      secondsEl.textContent = String(Math.max(1, Math.ceil((DURATION_MS - elapsed) / 1000)));
    }

    if (progress >= 1) {
      goHome();
      return;
    }

    window.setTimeout(tick, TICK_MS);
  }

  tick();
})();
