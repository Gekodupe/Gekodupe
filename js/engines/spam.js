// Geckodupe Spam Engine: production despam for forms, lists, and logs (browser, headless-friendly)

var SPAM_HONEYPOT_FIELDS = [
  '_gotcha', '_honey', '_honeytrap', 'honeypot', 'website', 'url', 'fax',
  'company_url', 'homepage', 'phone2', 'address2', 'confirm_email_leave_blank'
];

var SPAM_DISPOSABLE_DOMAINS = [
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', '10minutemail.com',
  'yopmail.com', 'trashmail.com', 'sharklasers.com', 'discard.email',
  'temp-mail.org', 'getnada.com', 'maildrop.cc', 'mailnesia.com',
  'throwawaymail.com', 'fakeinbox.com', 'moakt.com', 'emailondeck.com',
  'guerrillamail.org', 'spamgourmet.com', 'mailcatch.com', 'tempr.email'
];

var SPAM_SHORT_LINK_HOSTS = [
  'bit.ly', 't.co', 'goo.gl', 'tinyurl.com', 'ow.ly', 'buff.ly',
  'rebrand.ly', 'cutt.ly', 'is.gd', 'v.gd', 'rb.gy', 'shorturl.at'
];

var SPAM_BAIT_PATTERNS = [
  /\bviagra\b/i,
  /\bcialis\b/i,
  /\bcrypto\s*(airdrop|giveaway|pump)\b/i,
  /\bfree\s*money\b/i,
  /\bact\s*now\b/i,
  /\blimited\s*time\s*offer\b/i,
  /\bwork\s*from\s*home\b/i,
  /\bdouble\s*your\s*(btc|bitcoin|crypto)\b/i,
  /\bseo\s*backlinks?\b/i,
  /\bcasin[oо]\b/i,
  /<script\b/i,
  /javascript\s*:/i,
  /on(?:error|load|click)\s*=/i,
  /\$\{[^}]+\}/,
  /\{\{[^}]+\}\}/
];

function spamDefaultOpts(overrides) {
  var o = {
    mode: 'form',
    detectHoneypot: true,
    stripTrackers: true,
    detectUrlFlood: true,
    detectDisposable: true,
    detectBait: true,
    simThreshold: 0.85,
    blockScore: 0.72,
    softScore: 0.42,
    blocklist: [],
    recentFingerprints: [],
    burstWindowMs: 120000,
    maxUrls: 3,
    minMeaningfulChars: 2
  };
  if (overrides) {
    Object.keys(overrides).forEach(function (k) {
      if (overrides[k] !== undefined) o[k] = overrides[k];
    });
  }
  if (typeof o.blocklist === 'string') {
    o.blocklist = o.blocklist.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  if (!Array.isArray(o.blocklist)) o.blocklist = [];
  if (!Array.isArray(o.recentFingerprints)) o.recentFingerprints = [];
  return o;
}

function spamNormalizeText(text, stripTrackers) {
  var s = String(text || '');
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (stripTrackers !== false) {
    s = s.replace(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/g, ' ');
    s = s.replace(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\b/gi, ' ');
    s = s.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, ' ');
    s = s.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, ' ');
    s = s.replace(/(\?|&)([^=\s&]+)=([^&\s]*)/g, ' ');
  }
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

function spamCanonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(spamCanonicalJson).join(',') + ']';
  }
  var keys = Object.keys(value).sort();
  return '{' + keys.map(function (k) {
    return JSON.stringify(k) + ':' + spamCanonicalJson(value[k]);
  }).join(',') + '}';
}

function decodeURIComponentSafe(s) {
  try {
    return decodeURIComponent(String(s).replace(/\+/g, ' '));
  } catch (e) {
    return String(s);
  }
}

function spamParseFormFields(text) {
  var fields = {};
  var trimmed = String(text || '').trim();
  if (!trimmed) return fields;

  if (trimmed.charAt(0) === '{') {
    try {
      var obj = JSON.parse(trimmed);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        Object.keys(obj).forEach(function (k) {
          var v = obj[k];
          if (v != null && typeof v === 'object') fields[k] = JSON.stringify(v);
          else fields[k] = v == null ? '' : String(v);
        });
        fields.__spamParseOk = true;
        return fields;
      }
    } catch (e) {
      fields.__spamParseError = 'invalid_json';
      return fields;
    }
  }

  var parts = trimmed.indexOf('\n') >= 0 ? trimmed.split(/\r?\n/) : trimmed.split(/&/);
  parts.forEach(function (part) {
    var p = part.trim();
    if (!p) return;
    var eq = p.indexOf('=');
    var colon = p.indexOf(':');
    var sep = -1;
    if (eq > 0 && (colon < 0 || eq < colon)) sep = eq;
    else if (colon > 0) sep = colon;
    if (sep < 0) return;
    var key = decodeURIComponentSafe(p.slice(0, sep).trim());
    var val = decodeURIComponentSafe(p.slice(sep + 1).trim());
    if (key && key.indexOf('__spam') !== 0) fields[key] = val;
  });
  return fields;
}

function spamSimpleHash(str) {
  var h = 2166136261;
  var s = String(str || '');
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function spamUniqueReasons(reasons) {
  var seen = {};
  return (reasons || []).filter(function (r) {
    if (!r || seen[r]) return false;
    seen[r] = true;
    return true;
  });
}

function spamExtractUrls(text) {
  return String(text || '').match(/https?:\/\/[^\s<>"']+/gi) || [];
}

function spamHostFromUrl(url) {
  try {
    var u = String(url).replace(/^https?:\/\//i, '');
    return u.split('/')[0].toLowerCase().replace(/^www\./, '');
  } catch (e) {
    return '';
  }
}

function spamLooksDisposableEmail(text) {
  var m = String(text || '').match(/[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,})/i);
  if (!m) return false;
  return SPAM_DISPOSABLE_DOMAINS.indexOf(m[1].toLowerCase()) >= 0;
}

function spamHasShortLinks(text) {
  var urls = spamExtractUrls(text);
  for (var i = 0; i < urls.length; i++) {
    var host = spamHostFromUrl(urls[i]);
    if (SPAM_SHORT_LINK_HOSTS.indexOf(host) >= 0) return true;
  }
  return false;
}

function spamHasBait(text) {
  for (var i = 0; i < SPAM_BAIT_PATTERNS.length; i++) {
    if (SPAM_BAIT_PATTERNS[i].test(text)) return true;
  }
  return false;
}

function spamLooksGibberish(text) {
  var s = String(text || '').replace(/\s+/g, '');
  if (s.length < 16) return false;
  var vowels = (s.match(/[aeiou]/gi) || []).length;
  var letters = (s.match(/[a-z]/gi) || []).length;
  if (letters < 12) return false;
  if (vowels / letters < 0.12) return true;
  if (/(.)\1{5,}/.test(s)) return true;
  return false;
}

function spamHasMixedScript(text) {
  var hasLatin = /[A-Za-z]/.test(text);
  var hasCyrillic = /[\u0400-\u04FF]/.test(text);
  return hasLatin && hasCyrillic;
}

function spamFingerprint(input, opts) {
  opts = spamDefaultOpts(opts);
  var raw = typeof input === 'string' ? input : JSON.stringify(input || {});
  var base;
  if (opts.mode === 'form') {
    var fields = typeof input === 'object' && input && !Array.isArray(input)
      ? input
      : spamParseFormFields(raw);
    var cleaned = {};
    Object.keys(fields).sort().forEach(function (k) {
      if (k.indexOf('__spam') === 0) return;
      var lk = k.toLowerCase();
      if (SPAM_HONEYPOT_FIELDS.indexOf(lk) >= 0) return;
      cleaned[lk] = spamNormalizeText(fields[k], opts.stripTrackers);
    });
    base = spamCanonicalJson(cleaned);
  } else {
    base = spamNormalizeText(raw, opts.stripTrackers);
  }
  return spamSimpleHash(base);
}

function spamScorePayload(input, opts) {
  opts = spamDefaultOpts(opts);
  var reasons = [];
  var score = 0;
  var raw = typeof input === 'string' ? input : '';
  var fields = null;

  if (opts.mode === 'form' || (typeof input === 'object' && input && !Array.isArray(input))) {
    fields = typeof input === 'object' && input && !Array.isArray(input)
      ? input
      : spamParseFormFields(raw || JSON.stringify(input || {}));
    raw = Object.keys(fields).map(function (k) { return k + '=' + fields[k]; }).join('\n');
  }

  var textBlob = raw || (typeof input === 'string' ? input : JSON.stringify(input || {}));
  var normalized = spamNormalizeText(textBlob, opts.stripTrackers);

  if (!String(textBlob).trim()) {
    return {
      score: 0,
      reasons: ['empty'],
      decision: 'soft_reject',
      fingerprint: spamSimpleHash(''),
      normalized: '',
      mode: opts.mode
    };
  }

  if (opts.detectHoneypot && fields) {
    Object.keys(fields).forEach(function (k) {
      if (SPAM_HONEYPOT_FIELDS.indexOf(k.toLowerCase()) >= 0 && String(fields[k] || '').trim()) {
        reasons.push('honeypot');
        score = Math.max(score, 0.98);
      }
    });
  }

  if (opts.blocklist.length) {
    var lower = textBlob.toLowerCase();
    for (var b = 0; b < opts.blocklist.length; b++) {
      var phrase = String(opts.blocklist[b] || '').toLowerCase();
      if (phrase && lower.indexOf(phrase) >= 0) {
        reasons.push('blocklist');
        score = Math.max(score, 0.92);
        break;
      }
    }
  }

  if (opts.detectUrlFlood) {
    var urls = spamExtractUrls(textBlob);
    var lines = textBlob.split(/\n/).filter(Boolean).length || 1;
    var maxUrls = opts.maxUrls || 3;
    if (urls.length >= maxUrls + 1 || (urls.length >= 2 && urls.length / Math.max(lines, 1) > 0.5)) {
      reasons.push('url_flood');
      score = Math.max(score, 0.74);
    }
    if (spamHasShortLinks(textBlob)) {
      reasons.push('short_link');
      score = Math.max(score, 0.55);
    }
  }

  if (opts.detectDisposable !== false && spamLooksDisposableEmail(textBlob)) {
    reasons.push('disposable_email');
    score = Math.max(score, 0.62);
  }

  if (opts.detectBait !== false) {
    if (spamHasBait(textBlob)) {
      reasons.push('bait');
      score = Math.max(score, 0.78);
    }
    if (spamLooksGibberish(textBlob)) {
      reasons.push('gibberish');
      score = Math.max(score, 0.58);
    }
    if (spamHasMixedScript(textBlob)) {
      reasons.push('mixed_script');
      score = Math.max(score, 0.5);
    }
  }

  var letters = textBlob.replace(/[^A-Za-z]/g, '');
  if (letters.length >= 12) {
    var upper = letters.replace(/[^A-Z]/g, '').length;
    if (upper / letters.length > 0.78) {
      reasons.push('all_caps');
      score = Math.max(score, 0.4);
    }
  }

  var tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length >= 6) {
    var freq = {};
    var maxRep = 0;
    tokens.forEach(function (t) {
      freq[t] = (freq[t] || 0) + 1;
      if (freq[t] > maxRep) maxRep = freq[t];
    });
    if (maxRep / tokens.length > 0.45) {
      reasons.push('repeated_tokens');
      score = Math.max(score, 0.52);
    }
  }

  var fp = spamFingerprint(fields || textBlob, opts);
  var recent = opts.recentFingerprints;
  var simFn = typeof calculateSimilarity === 'function' ? calculateSimilarity : null;
  for (var i = 0; i < recent.length; i++) {
    var prev = recent[i];
    var prevFp = typeof prev === 'string' ? prev : (prev && prev.fingerprint);
    var prevNorm = typeof prev === 'object' && prev && prev.normalized ? prev.normalized : '';
    if (prevFp && prevFp === fp) {
      reasons.push('burst');
      score = Math.max(score, 0.9);
      break;
    }
    if (simFn && prevNorm && normalized) {
      var sim = simFn(normalized, prevNorm);
      if (sim >= opts.simThreshold) {
        reasons.push('near_duplicate');
        score = Math.max(score, 0.76);
        break;
      }
    }
  }

  reasons = spamUniqueReasons(reasons);
  var decision = 'allow';
  if (score >= opts.blockScore) decision = 'block';
  else if (score >= opts.softScore) decision = 'soft_reject';

  return {
    score: Math.round(score * 1000) / 1000,
    reasons: reasons,
    decision: decision,
    fingerprint: fp,
    normalized: normalized,
    mode: opts.mode
  };
}

function spamFormatFields(fields) {
  return Object.keys(fields).map(function (k) {
    return k + '=' + fields[k];
  }).join('\n');
}

function spamCleanFormPayload(text, opts) {
  var fields = spamParseFormFields(text);
  if (fields.__spamParseError === 'invalid_json') {
    var errScore = {
      score: 0,
      reasons: ['parse_error'],
      decision: 'soft_reject',
      fingerprint: '',
      normalized: '',
      mode: 'form'
    };
    return {
      cleaned: '',
      removedCount: 0,
      keptCount: 0,
      removed: [],
      score: errScore,
      parseError: 'invalid_json'
    };
  }
  delete fields.__spamParseOk;
  delete fields.__spamParseError;

  var keys = Object.keys(fields).filter(function (k) {
    return k.indexOf('__spam') !== 0;
  });
  if (!keys.length) {
    return spamCleanLines(text, opts);
  }

  var whole = spamScorePayload(fields, opts);
  if (whole.decision === 'block' && whole.reasons.indexOf('honeypot') >= 0) {
    return {
      cleaned: '',
      removedCount: keys.length,
      keptCount: 0,
      removed: keys.map(function (k, index) {
        return { line: k + '=' + fields[k], index: index, reasons: whole.reasons };
      }),
      score: whole
    };
  }

  var keptFields = {};
  var removed = [];
  var idx = 0;
  keys.forEach(function (k) {
    var lk = k.toLowerCase();
    var line = k + '=' + fields[k];
    if (opts.detectHoneypot && SPAM_HONEYPOT_FIELDS.indexOf(lk) >= 0) {
      if (String(fields[k] || '').trim()) {
        removed.push({ line: line, index: idx, reasons: ['honeypot'] });
      }
      idx++;
      return;
    }
    var fieldScore = spamScorePayload(String(fields[k] || ''), Object.assign({}, opts, { mode: 'list' }));
    var blockHit = false;
    if (opts.blocklist.length) {
      var lower = (k + ' ' + fields[k]).toLowerCase();
      blockHit = opts.blocklist.some(function (p) {
        return p && lower.indexOf(String(p).toLowerCase()) >= 0;
      });
    }
    if (blockHit || fieldScore.decision === 'block') {
      removed.push({
        line: line,
        index: idx,
        reasons: spamUniqueReasons(fieldScore.reasons.concat(blockHit ? ['blocklist'] : []))
      });
    } else {
      keptFields[k] = fields[k];
    }
    idx++;
  });

  return {
    cleaned: spamFormatFields(keptFields),
    removedCount: removed.length,
    keptCount: Object.keys(keptFields).length,
    removed: removed,
    score: whole
  };
}

function spamCleanLines(text, opts) {
  var lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  var kept = [];
  var removed = [];
  var keptNorm = [];
  var softMatch = true;
  var SIM_LINE_CAP = 8000;
  if (lines.length > SIM_LINE_CAP) softMatch = false;

  lines.forEach(function (line, idx) {
    var trimmed = line.trim();
    if (!trimmed) {
      kept.push(line);
      return;
    }

    var lineOpts = Object.assign({}, opts, {
      mode: opts.mode === 'form' ? 'list' : opts.mode
    });
    var norm = spamNormalizeText(trimmed, opts.stripTrackers);
    var isDup = keptNorm.some(function (n) {
      if (n === norm) return true;
      if (softMatch && typeof calculateSimilarity === 'function') {
        return calculateSimilarity(n, norm) >= opts.simThreshold;
      }
      return false;
    });

    var score = spamScorePayload(trimmed, Object.assign({}, lineOpts, {
      recentFingerprints: keptNorm.map(function (n) {
        return { fingerprint: spamSimpleHash(n), normalized: n };
      })
    }));

    var blocklistHit = false;
    if (opts.blocklist.length) {
      var lower = trimmed.toLowerCase();
      blocklistHit = opts.blocklist.some(function (p) {
        return p && lower.indexOf(String(p).toLowerCase()) >= 0;
      });
    }

    var drop = blocklistHit || score.decision === 'block' || (isDup && opts.mode !== 'log');
    if (!drop && score.decision === 'soft_reject' && opts.mode === 'list') drop = true;
    if (!drop && opts.mode === 'log' && score.decision === 'soft_reject' &&
        (score.reasons.indexOf('bait') >= 0 || score.reasons.indexOf('url_flood') >= 0)) {
      drop = true;
    }

    if (drop) {
      removed.push({
        line: line,
        index: idx,
        reasons: spamUniqueReasons(
          score.reasons
            .concat(isDup ? ['near_duplicate'] : [])
            .concat(blocklistHit ? ['blocklist'] : [])
        )
      });
      return;
    }

    kept.push(line);
    keptNorm.push(norm);
  });

  var outScore = spamScorePayload(text, opts);
  return {
    cleaned: kept.join('\n'),
    removedCount: removed.length,
    keptCount: kept.filter(function (l) { return l.trim(); }).length,
    removed: removed,
    score: outScore,
    softMatchSkipped: !softMatch
  };
}

function spamCleanText(text, opts) {
  opts = spamDefaultOpts(opts);
  if (opts.mode === 'form') return spamCleanFormPayload(text, opts);
  return spamCleanLines(text, opts);
}

function scoreSpamPayload(input, opts) {
  return spamScorePayload(input, opts);
}

function cleanSpamText(text, opts) {
  return spamCleanText(text, opts);
}

function fingerprintSpam(input, opts) {
  return spamFingerprint(input, opts);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    spamDefaultOpts: spamDefaultOpts,
    spamNormalizeText: spamNormalizeText,
    spamFingerprint: spamFingerprint,
    spamScorePayload: spamScorePayload,
    spamCleanText: spamCleanText,
    scoreSpamPayload: scoreSpamPayload,
    cleanSpamText: cleanSpamText,
    fingerprintSpam: fingerprintSpam,
    spamParseFormFields: spamParseFormFields
  };
}
