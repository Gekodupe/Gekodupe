var GECKODUPE_CHECKPOINTS = [];
var GECKODUPE_CHECKPOINT_MAX = 12;
var GECKODUPE_LAST_CHECKPOINT_ID = null;

function geckoDeepClone(val) {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return val;
  if (typeof ArrayBuffer !== 'undefined' && val instanceof ArrayBuffer) {
    return val.slice(0);
  }
  if (typeof DataView !== 'undefined' && val instanceof DataView) {
    var buf = val.buffer.slice(val.byteOffset, val.byteOffset + val.byteLength);
    return new DataView(buf);
  }
  if (val instanceof Uint8Array || (typeof val.length === 'number' && typeof val.BYTES_PER_ELEMENT === 'number')) {
    return cloneBinaryData(val);
  }
  if (Array.isArray(val)) return val.map(geckoDeepClone);
  if (typeof val === 'object') {
    var out = {};
    Object.keys(val).forEach(function(k) { out[k] = geckoDeepClone(val[k]); });
    return out;
  }
  return val;
}

function createCheckpoint(label, payload, opts) {
  opts = opts || {};
  var cp = {
    id: 'cp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
    label: label || 'checkpoint',
    createdAt: Date.now(),
    payload: geckoDeepClone(payload)
  };
  GECKODUPE_CHECKPOINTS.unshift(cp);
  if (GECKODUPE_CHECKPOINTS.length > GECKODUPE_CHECKPOINT_MAX) {
    GECKODUPE_CHECKPOINTS.length = GECKODUPE_CHECKPOINT_MAX;
  }
  GECKODUPE_LAST_CHECKPOINT_ID = cp.id;
  if (!opts.silent) safeLog('Checkpoint saved: ' + cp.label + ' [' + cp.id + ']');
  return cp.id;
}

function getCheckpoint(id) {
  var target = id || GECKODUPE_LAST_CHECKPOINT_ID;
  if (!target) return null;
  for (var i = 0; i < GECKODUPE_CHECKPOINTS.length; i++) {
    if (GECKODUPE_CHECKPOINTS[i].id === target) {
      return geckoDeepClone(GECKODUPE_CHECKPOINTS[i]);
    }
  }
  return null;
}

function restoreCheckpoint(id) {
  var cp = getCheckpoint(id);
  return cp ? geckoDeepClone(cp.payload) : null;
}

function listCheckpoints() {
  return GECKODUPE_CHECKPOINTS.map(function(cp) {
    return { id: cp.id, label: cp.label, createdAt: cp.createdAt };
  });
}

function deleteCheckpoint(id) {
  GECKODUPE_CHECKPOINTS = GECKODUPE_CHECKPOINTS.filter(function(cp) { return cp.id !== id; });
  if (GECKODUPE_LAST_CHECKPOINT_ID === id) {
    GECKODUPE_LAST_CHECKPOINT_ID = GECKODUPE_CHECKPOINTS.length ? GECKODUPE_CHECKPOINTS[0].id : null;
  }
}

function getLastCheckpointId() {
  return GECKODUPE_LAST_CHECKPOINT_ID;
}

function cloneBinaryData(data) {
  if (data == null) return null;
  if (typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer) {
    return data.slice(0);
  }
  if (typeof data.length === 'number' && typeof data.BYTES_PER_ELEMENT === 'number') {
    var copy = new Uint8Array(data.length);
    for (var i = 0; i < data.length; i++) copy[i] = data[i];
    return copy;
  }
  return geckoDeepClone(data);
}

function cloneFolderFiles(files) {
  return (files || []).map(function(f) {
    return {
      path: f.path,
      content: f.content,
      binary: !!f.binary,
      binaryData: cloneBinaryData(f.binaryData),
      format: f.format
    };
  });
}

function cloneMediaFiles(files) {
  return (files || []).map(function(f) {
    return {
      path: f.path,
      binary: true,
      binaryData: cloneBinaryData(f.binaryData),
      content: null
    };
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createCheckpoint: createCheckpoint,
    getCheckpoint: getCheckpoint,
    restoreCheckpoint: restoreCheckpoint,
    listCheckpoints: listCheckpoints,
    deleteCheckpoint: deleteCheckpoint,
    getLastCheckpointId: getLastCheckpointId,
    geckoDeepClone: geckoDeepClone,
    cloneFolderFiles: cloneFolderFiles,
    cloneMediaFiles: cloneMediaFiles
  };
}
