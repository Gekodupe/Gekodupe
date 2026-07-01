var geckodupeOptionPrefix = '';

function setOptionPrefix(prefix) {
  geckodupeOptionPrefix = prefix || '';
}

function getOptionPrefix() {
  return geckodupeOptionPrefix;
}

function getEngineEl(id) {
  if (!id) return null;
  return document.getElementById(geckodupeOptionPrefix + id);
}

function isEngineChecked(id, defaultVal) {
  var el = getEngineEl(id);
  if (!el || el.type !== 'checkbox') return defaultVal !== undefined ? defaultVal : false;
  return el.checked;
}

function getEngineValue(id, defaultVal) {
  var el = getEngineEl(id);
  if (!el) return defaultVal;
  return el.value;
}

function safeLog(msg) {
  if (typeof logActivity === 'function') logActivity(msg);
}

function safeToast(msg, type) {
  if (typeof showToast === 'function') showToast(msg, type);
}

function withOptionPrefix(prefix, fn) {
  var prev = geckodupeOptionPrefix;
  geckodupeOptionPrefix = prefix || '';
  try {
    return fn();
  } finally {
    geckodupeOptionPrefix = prev;
  }
}
