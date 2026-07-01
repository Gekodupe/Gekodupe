// Img / Vid duplicate preview modal

(function() {
  var modal = null;
  var titleEl = null;
  var contentEl = null;
  var openBtn = null;
  var renderToken = 0;

  function getEls() {
    if (!modal) modal = document.getElementById('media-preview-modal');
    if (!titleEl) titleEl = document.getElementById('media-preview-title');
    if (!contentEl) contentEl = document.getElementById('media-preview-content');
    if (!openBtn) openBtn = document.getElementById('media-preview-open');
    return modal && titleEl && contentEl;
  }

  function basename(path) {
    var parts = (path || '').split('/');
    return parts[parts.length - 1] || path;
  }

  function normPath(path) {
    return typeof normalizePath === 'function' ? normalizePath(path || '') : (path || '');
  }

  function previewBinaryData(entry) {
    if (!entry || !entry.binaryData) return null;
    var data = entry.binaryData;
    if (!data.byteLength) return null;
    if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(data)) {
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    }
    if (typeof data.slice === 'function') {
      try { return data.slice(0); } catch (e) { return data; }
    }
    return data;
  }

  function previewEntries(list) {
    if (!list) return [];
    if (Array.isArray(list)) return list;
    return [list];
  }

  function fileLibrary() {
    var result = typeof mediaProcessedResult !== 'undefined' ? mediaProcessedResult : null;
    if (result && result.allFiles && result.allFiles.length) return result.allFiles;
    if (typeof mediaProjectFiles !== 'undefined' && mediaProjectFiles.length) return mediaProjectFiles;
    return [];
  }

  function fileByPath(path) {
    var target = normPath(path);
    var files = fileLibrary();
    for (var i = 0; i < files.length; i++) {
      if (normPath(files[i].path) === target) return files[i];
    }
    return null;
  }

  function resolvePreviewEntry(entry) {
    if (!entry) return null;
    if (typeof entry === 'string') {
      var fromPath = fileByPath(entry);
      if (!fromPath || !fromPath.binaryData) return null;
      return typeof mediaPreviewEntry === 'function'
        ? mediaPreviewEntry(fromPath)
        : { path: fromPath.path, kind: 'image', binaryData: fromPath.binaryData };
    }
    if (entry.path && entry.binaryData && entry.binaryData.byteLength) {
      return entry;
    }
    if (entry.path) {
      var file = fileByPath(entry.path);
      if (!file || !file.binaryData) return null;
      return typeof mediaPreviewEntry === 'function'
        ? mediaPreviewEntry(file)
        : { path: file.path, kind: 'image', binaryData: file.binaryData };
    }
    return null;
  }

  function resolvePreviewGroups() {
    var result = typeof mediaProcessedResult !== 'undefined' ? mediaProcessedResult : null;
    if (!result) return [];

    var raw = result.previewGroups;
    if (!raw || !raw.length) {
      if (result.clusters && result.clusters.length && typeof buildMediaPreviewGroups === 'function') {
        return buildMediaPreviewGroups(fileLibrary(), result.clusters, []);
      }
      return [];
    }

    return raw.map(function(group) {
      return {
        type: group.type || 'variation',
        kept: previewEntries(group.kept).map(resolvePreviewEntry).filter(Boolean),
        removed: previewEntries(group.removed).map(resolvePreviewEntry).filter(Boolean)
      };
    }).filter(function(group) {
      return group.kept.length || group.removed.length;
    });
  }

  function appendMissing(card, message) {
    var missing = document.createElement('div');
    missing.className = 'media-preview-missing';
    missing.textContent = message || 'Preview unavailable';
    card.appendChild(missing);
  }

  function entryMime(entry) {
    return typeof mimeFromMediaPath === 'function'
      ? mimeFromMediaPath(entry.path)
      : 'application/octet-stream';
  }

  function drawBitmapToCanvas(bitmap) {
    var canvas = document.createElement('canvas');
    canvas.className = 'media-preview-canvas';
    var maxW = 280;
    var maxH = 160;
    var scale = Math.min(1, maxW / bitmap.width, maxH / bitmap.height);
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    var ctx = canvas.getContext('2d');
    if (ctx) ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    if (bitmap.close) bitmap.close();
    return canvas;
  }

  function renderImagePreview(card, slot, entry) {
    var buffer = previewBinaryData(entry);
    if (!buffer) {
      appendMissing(slot);
      return Promise.resolve();
    }

    var mime = entryMime(entry);
    if (mime.indexOf('image/') !== 0) {
      appendMissing(slot, 'Not an image');
      return Promise.resolve();
    }

    var blob = new Blob([buffer], { type: mime });
    if (typeof createImageBitmap === 'function') {
      return createImageBitmap(blob).then(function(bitmap) {
        slot.appendChild(drawBitmapToCanvas(bitmap));
      }).catch(function() {
        return renderImagePreviewViaImage(slot, blob, buffer, mime);
      });
    }
    return renderImagePreviewViaImage(slot, blob, buffer, mime);
  }

  function isFileProtocol() {
    return typeof location !== 'undefined' && location.protocol === 'file:';
  }

  function bufferToDataUrl(buffer, mime) {
    var bytes = new Uint8Array(buffer);
    var chunk = 0x8000;
    var parts = [];
    for (var i = 0; i < bytes.length; i += chunk) {
      parts.push(String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.length))));
    }
    return 'data:' + mime + ';base64,' + btoa(parts.join(''));
  }

  function renderImagePreviewViaImage(slot, blob, buffer, mime) {
    return new Promise(function(resolve) {
      var img = document.createElement('img');
      img.className = 'media-preview-image';
      img.alt = '';
      img.onload = function() {
        try {
          slot.appendChild(drawBitmapToCanvas(img));
        } catch (e) {
          appendMissing(slot);
        }
        resolve();
      };
      img.onerror = function() {
        appendMissing(slot);
        resolve();
      };
      if (isFileProtocol() && buffer) {
        try {
          img.src = bufferToDataUrl(buffer, mime);
          return;
        } catch (e) { /* fall through */ }
      }
      img.src = URL.createObjectURL(blob);
      setTimeout(function() {
        try { URL.revokeObjectURL(img.src); } catch (e) { /* ignore */ }
      }, 30000);
    });
  }

  function renderVideoPreview(card, slot, entry) {
    var buffer = previewBinaryData(entry);
    if (!buffer) {
      appendMissing(slot);
      return Promise.resolve();
    }

    var mime = entryMime(entry);
    var blob = new Blob([buffer], { type: mime });
    return new Promise(function(resolve) {
      var video = document.createElement('video');
      video.className = 'media-preview-video';
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.onloadeddata = function() {
        try {
          var canvas = document.createElement('canvas');
          canvas.className = 'media-preview-canvas';
          var w = video.videoWidth || 320;
          var h = video.videoHeight || 180;
          var scale = Math.min(1, 280 / w, 160 / h);
          canvas.width = Math.max(1, Math.round(w * scale));
          canvas.height = Math.max(1, Math.round(h * scale));
          var ctx = canvas.getContext('2d');
          if (ctx) ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          slot.appendChild(canvas);
        } catch (e) {
          appendMissing(slot, 'Video preview unavailable');
        }
        cleanup();
        resolve();
      };
      video.onerror = function() {
        appendMissing(slot, 'Video preview unavailable');
        cleanup();
        resolve();
      };
      var url = URL.createObjectURL(blob);
      function cleanup() {
        video.removeAttribute('src');
        try { video.load(); } catch (e) { /* ignore */ }
        try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
      }
      video.src = url;
      setTimeout(function() {
        if (!slot.querySelector('.media-preview-canvas, .media-preview-missing')) {
          appendMissing(slot, 'Video preview unavailable');
          cleanup();
          resolve();
        }
      }, 4000);
    });
  }

  function renderMediaCard(entry) {
    var card = document.createElement('div');
    card.className = 'media-preview-card';

    var label = document.createElement('p');
    label.className = 'media-preview-card-label';
    label.textContent = basename(entry.path);
    label.title = entry.path;
    card.appendChild(label);

    var slot = document.createElement('div');
    slot.className = 'media-preview-media-slot';
    card.appendChild(slot);

    var kind = entry.kind || (typeof isMediaVideoPath === 'function' && isMediaVideoPath(entry.path) ? 'video' : 'image');
    if (kind === 'video') return renderVideoPreview(card, slot, entry).then(function() { return card; });
    return renderImagePreview(card, slot, entry).then(function() { return card; });
  }

  function renderMediaGrid(entries) {
    var grid = document.createElement('div');
    grid.className = 'media-preview-grid';
    var jobs = entries.map(function(entry) {
      return renderMediaCard(entry).then(function(card) {
        grid.appendChild(card);
      });
    });
    return Promise.all(jobs).then(function() { return grid; });
  }

  function renderGroupBlock(group, index, token) {
    var kept = previewEntries(group.kept);
    var removed = previewEntries(group.removed);
    if (!kept.length && !removed.length) return Promise.resolve(null);

    var block = document.createElement('div');
    block.className = 'media-preview-group';

    var heading = document.createElement('h3');
    var typeLabel = group.type === 'burst'
      ? 'Burst sequence'
      : (group.type === 'target' ? 'Target match' : 'Variation group');
    heading.textContent = typeLabel + ' ' + (index + 1);
    block.appendChild(heading);

    var chain = Promise.resolve();
    if (kept.length) {
      var keptTitle = document.createElement('p');
      keptTitle.className = 'media-preview-section-label media-preview-section-label--kept';
      keptTitle.textContent = 'Kept (' + kept.length + ')';
      block.appendChild(keptTitle);
      chain = chain.then(function() {
        return renderMediaGrid(kept);
      }).then(function(grid) {
        if (token !== renderToken) return;
        block.appendChild(grid);
      });
    }
    if (removed.length) {
      chain = chain.then(function() {
        var removedTitle = document.createElement('p');
        removedTitle.className = 'media-preview-section-label media-preview-section-label--removed';
        removedTitle.textContent = 'Removed (' + removed.length + ')';
        block.appendChild(removedTitle);
        return renderMediaGrid(removed);
      }).then(function(grid) {
        if (token !== renderToken) return;
        block.appendChild(grid);
      });
    }

    return chain.then(function() {
      if (token !== renderToken) return null;
      return block;
    });
  }

  function renderPreviewGroups(groups, token) {
    if (!groups || !groups.length) {
      contentEl.innerHTML = '';
      var empty = document.createElement('p');
      empty.className = 'media-preview-empty';
      empty.textContent = 'No duplicate groups to preview. Run deduplication first.';
      contentEl.appendChild(empty);
      return Promise.resolve();
    }

    return Promise.all(groups.map(function(group, index) {
      return renderGroupBlock(group, index, token);
    })).then(function(blocks) {
      if (token !== renderToken) return;
      contentEl.innerHTML = '';
      blocks.filter(Boolean).forEach(function(block) {
        contentEl.appendChild(block);
      });
      if (!contentEl.children.length) {
        var fallback = document.createElement('p');
        fallback.className = 'media-preview-empty';
        fallback.textContent = 'Could not build previews for these groups. Try running deduplication again.';
        contentEl.appendChild(fallback);
      }
    });
  }

  function hasPreviewableGroups() {
    var result = typeof mediaProcessedResult !== 'undefined' ? mediaProcessedResult : null;
    if (!result) return false;
    if (result.previewGroups && result.previewGroups.length) return true;
    if (result.clusters && result.clusters.length) return true;
    return false;
  }

  function updateMediaPreviewButton() {
    if (!openBtn) openBtn = document.getElementById('media-preview-open');
    if (!openBtn) return;
    var enabled = hasPreviewableGroups();
    openBtn.disabled = !enabled;
    openBtn.title = enabled
      ? 'Preview kept vs removed files'
      : 'Run deduplication to preview duplicate groups';
  }

  function openMediaPreview() {
    if (!getEls()) return;
    var groups = resolvePreviewGroups();
    if (!groups.length) {
      if (typeof showToast === 'function') showToast('Nothing to preview yet', 'warning');
      return;
    }

    renderToken++;
    var token = renderToken;
    titleEl.textContent = 'Kept vs removed (' + groups.length + ' group' + (groups.length === 1 ? '' : 's') + ')';
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    contentEl.innerHTML = '<p class="media-preview-empty">Loading previews...</p>';

    renderPreviewGroups(groups, token).catch(function(err) {
      if (token !== renderToken) return;
      contentEl.innerHTML = '';
      var errMsg = document.createElement('p');
      errMsg.className = 'media-preview-empty';
      errMsg.textContent = 'Could not load previews: ' + (err && err.message ? err.message : 'unknown error');
      contentEl.appendChild(errMsg);
    });
  }

  function closeMediaPreview() {
    if (!modal) return;
    renderToken++;
    modal.hidden = true;
    document.body.style.overflow = '';
    if (contentEl) contentEl.innerHTML = '';
  }

  function initMediaPreview() {
    if (!getEls()) return;

    if (openBtn) {
      openBtn.addEventListener('click', function(e) {
        e.preventDefault();
        openMediaPreview();
      });
    }

    modal.querySelectorAll('[data-media-preview-close]').forEach(function(el) {
      el.addEventListener('click', closeMediaPreview);
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && modal && !modal.hidden) closeMediaPreview();
    });

    window.updateMediaPreviewButton = updateMediaPreviewButton;
    updateMediaPreviewButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMediaPreview);
  } else {
    initMediaPreview();
  }
})();
