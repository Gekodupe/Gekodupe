// Demo field preview modal (eye icon)

(function() {
  var modal = null;
  var titleEl = null;
  var contentEl = null;
  var copyBtn = null;
  var activeSourceId = null;

  function getEls() {
    if (!modal) modal = document.getElementById('demo-preview-modal');
    if (!titleEl) titleEl = document.getElementById('demo-preview-title');
    if (!contentEl) contentEl = document.getElementById('demo-preview-content');
    if (!copyBtn) copyBtn = document.getElementById('demo-preview-copy');
    return modal && titleEl && contentEl;
  }

  function readFieldValue(id) {
    var el = document.getElementById(id);
    if (!el) return '';
    return el.value != null ? el.value : (el.textContent || '');
  }

  function openDemoPreview(sourceId, title) {
    if (!getEls()) return;
    activeSourceId = sourceId;
    titleEl.textContent = title || 'Preview';
    contentEl.value = readFieldValue(sourceId);
    contentEl.style.height = '280px';
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeDemoPreview() {
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
    activeSourceId = null;
  }

  function refreshPreviewContent() {
    if (!contentEl || !activeSourceId || modal.hidden) return;
    contentEl.value = readFieldValue(activeSourceId);
  }

  function copyPreviewContent() {
    if (!contentEl) return;
    var text = contentEl.value;
    if (!text) {
      if (typeof showToast === 'function') showToast('Nothing to copy', 'warning');
      return;
    }
    function onSuccess() {
      if (typeof showToast === 'function') showToast('Copied to clipboard', 'success');
      if (copyBtn) {
        var orig = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(function() { copyBtn.textContent = orig; }, 1600);
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onSuccess).catch(function() {
        contentEl.select();
        document.execCommand('copy');
        onSuccess();
      });
    } else {
      contentEl.select();
      document.execCommand('copy');
      onSuccess();
    }
  }

  function initDemoPreview() {
    if (!getEls()) return;

    document.querySelectorAll('.demo-preview-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        openDemoPreview(btn.getAttribute('data-demo-source'), btn.getAttribute('data-demo-title'));
      });
    });

    modal.querySelectorAll('[data-demo-close]').forEach(function(el) {
      el.addEventListener('click', closeDemoPreview);
    });

    if (copyBtn) copyBtn.addEventListener('click', copyPreviewContent);

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && modal && !modal.hidden) closeDemoPreview();
    });

    window.refreshDemoPreview = refreshPreviewContent;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDemoPreview);
  } else {
    initDemoPreview();
  }
})();
