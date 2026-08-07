// TypeScript port of js/engines/spam.js - keep scorePayload / cleanText API aligned for parity tests

export type SpamMode = 'form' | 'list' | 'log';
export type SpamDecision = 'allow' | 'soft_reject' | 'block';

export interface SpamOpts {
  mode: SpamMode;
  detectHoneypot: boolean;
  stripTrackers: boolean;
  detectUrlFlood: boolean;
  detectDisposable: boolean;
  detectBait: boolean;
  simThreshold: number;
  blockScore: number;
  softScore: number;
  blocklist: string[];
  recentFingerprints: Array<string | { fingerprint?: string; normalized?: string }>;
  burstWindowMs: number;
  maxUrls: number;
  minMeaningfulChars: number;
}

export interface SpamScoreResult {
  score: number;
  reasons: string[];
  decision: SpamDecision;
  fingerprint: string;
  normalized: string;
  mode: SpamMode;
}

export interface SpamCleanResult {
  cleaned: string;
  removedCount: number;
  keptCount: number;
  removed: Array<{ line: string; index: number; reasons: string[] }>;
  score: SpamScoreResult;
}

const HONEYPOT_FIELDS = [
  '_gotcha', '_honey', '_honeytrap', 'honeypot', 'website', 'url', 'fax',
  'company_url', 'homepage', 'phone2', 'address2', 'confirm_email_leave_blank'
];

const DISPOSABLE = [
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', '10minutemail.com',
  'yopmail.com', 'trashmail.com', 'sharklasers.com', 'discard.email',
  'temp-mail.org', 'getnada.com', 'maildrop.cc', 'mailnesia.com',
  'throwawaymail.com', 'fakeinbox.com', 'moakt.com', 'emailondeck.com',
  'guerrillamail.org', 'spamgourmet.com', 'mailcatch.com', 'tempr.email'
];

const SHORT_LINK_HOSTS = [
  'bit.ly', 't.co', 'goo.gl', 'tinyurl.com', 'ow.ly', 'buff.ly',
  'rebrand.ly', 'cutt.ly', 'is.gd', 'v.gd', 'rb.gy', 'shorturl.at'
];

const BAIT_PATTERNS = [
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

export function spamDefaultOpts(overrides?: Partial<SpamOpts>): SpamOpts {
  const o: SpamOpts = {
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
  if (overrides) Object.assign(o, overrides);
  if (typeof (o.blocklist as unknown) === 'string') {
    o.blocklist = String(o.blocklist)
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(o.blocklist)) o.blocklist = [];
  if (!Array.isArray(o.recentFingerprints)) o.recentFingerprints = [];
  return o;
}

export function getWordSet(str: string): Set<string> {
  const words = str.toLowerCase().match(/\w+/g) || [];
  return new Set(words);
}

export function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  const set1 = getWordSet(str1);
  const set2 = getWordSet(str2);
  if (set1.size === 0 || set2.size === 0) return 0;
  let intersection = 0;
  set1.forEach((word) => {
    if (set2.has(word)) intersection++;
  });
  return intersection / (set1.size + set2.size - intersection);
}

export function spamNormalizeText(text: string, stripTrackers = true): string {
  let s = String(text || '');
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

function spamCanonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(spamCanonicalJson).join(',') + ']';
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + spamCanonicalJson((value as Record<string, unknown>)[k])).join(',') + '}';
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
}

function uniqueReasons(reasons: string[]): string[] {
  const seen: Record<string, boolean> = {};
  return reasons.filter((r) => {
    if (!r || seen[r]) return false;
    seen[r] = true;
    return true;
  });
}

export function spamParseFormFields(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const trimmed = String(text || '').trim();
  if (!trimmed) return fields;
  if (trimmed.charAt(0) === '{') {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        Object.keys(obj).forEach((k) => {
          const v = obj[k];
          if (v != null && typeof v === 'object') fields[k] = JSON.stringify(v);
          else fields[k] = v == null ? '' : String(v);
        });
        return fields;
      }
    } catch {
      /* fall through */
    }
  }
  const parts = trimmed.indexOf('\n') >= 0 ? trimmed.split(/\r?\n/) : trimmed.split(/&/);
  parts.forEach((part) => {
    const p = part.trim();
    if (!p) return;
    const eq = p.indexOf('=');
    const colon = p.indexOf(':');
    let sep = -1;
    if (eq > 0 && (colon < 0 || eq < colon)) sep = eq;
    else if (colon > 0) sep = colon;
    if (sep < 0) return;
    const key = decodeURIComponentSafe(p.slice(0, sep).trim());
    const val = decodeURIComponentSafe(p.slice(sep + 1).trim());
    if (key) fields[key] = val;
  });
  return fields;
}

export function spamSimpleHash(str: string): string {
  let h = 2166136261;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function extractUrls(text: string): string[] {
  return String(text || '').match(/https?:\/\/[^\s<>"']+/gi) || [];
}

function hostFromUrl(url: string): string {
  try {
    const u = String(url).replace(/^https?:\/\//i, '');
    return u.split('/')[0].toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function looksDisposableEmail(text: string): boolean {
  const m = String(text || '').match(/[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,})/i);
  if (!m) return false;
  return DISPOSABLE.indexOf(m[1].toLowerCase()) >= 0;
}

function hasShortLinks(text: string): boolean {
  const urls = extractUrls(text);
  for (let i = 0; i < urls.length; i++) {
    if (SHORT_LINK_HOSTS.indexOf(hostFromUrl(urls[i])) >= 0) return true;
  }
  return false;
}

function hasBait(text: string): boolean {
  for (let i = 0; i < BAIT_PATTERNS.length; i++) {
    if (BAIT_PATTERNS[i].test(text)) return true;
  }
  return false;
}

function looksGibberish(text: string): boolean {
  const s = String(text || '').replace(/\s+/g, '');
  if (s.length < 16) return false;
  const vowels = (s.match(/[aeiou]/gi) || []).length;
  const letters = (s.match(/[a-z]/gi) || []).length;
  if (letters < 12) return false;
  if (vowels / letters < 0.12) return true;
  if (/(.)\1{5,}/.test(s)) return true;
  return false;
}

function hasMixedScript(text: string): boolean {
  return /[A-Za-z]/.test(text) && /[\u0400-\u04FF]/.test(text);
}

export function spamFingerprint(input: string | Record<string, string>, opts?: Partial<SpamOpts>): string {
  const o = spamDefaultOpts(opts);
  const raw = typeof input === 'string' ? input : JSON.stringify(input || {});
  let base: string;
  if (o.mode === 'form') {
    const fields =
      typeof input === 'object' && input && !Array.isArray(input)
        ? input
        : spamParseFormFields(raw);
    const cleaned: Record<string, string> = {};
    Object.keys(fields)
      .sort()
      .forEach((k) => {
        const lk = k.toLowerCase();
        if (HONEYPOT_FIELDS.indexOf(lk) >= 0) return;
        cleaned[lk] = spamNormalizeText(fields[k], o.stripTrackers);
      });
    base = spamCanonicalJson(cleaned);
  } else {
    base = spamNormalizeText(raw, o.stripTrackers);
  }
  return spamSimpleHash(base);
}

export function scorePayload(input: string | Record<string, string>, opts?: Partial<SpamOpts>): SpamScoreResult {
  const o = spamDefaultOpts(opts);
  const reasons: string[] = [];
  let score = 0;
  let raw = typeof input === 'string' ? input : '';
  let fields: Record<string, string> | null = null;

  if (o.mode === 'form' || (typeof input === 'object' && input && !Array.isArray(input))) {
    fields =
      typeof input === 'object' && input && !Array.isArray(input)
        ? input
        : spamParseFormFields(raw || JSON.stringify(input || {}));
    raw = Object.keys(fields)
      .map((k) => k + '=' + fields![k])
      .join('\n');
  }

  const textBlob = raw || (typeof input === 'string' ? input : JSON.stringify(input || {}));
  const normalized = spamNormalizeText(textBlob, o.stripTrackers);

  if (!String(textBlob).trim()) {
    return {
      score: 0,
      reasons: ['empty'],
      decision: 'soft_reject',
      fingerprint: spamSimpleHash(''),
      normalized: '',
      mode: o.mode
    };
  }

  if (o.detectHoneypot && fields) {
    Object.keys(fields).forEach((k) => {
      if (HONEYPOT_FIELDS.indexOf(k.toLowerCase()) >= 0 && String(fields![k] || '').trim()) {
        reasons.push('honeypot');
        score = Math.max(score, 0.98);
      }
    });
  }

  if (o.blocklist.length) {
    const lower = textBlob.toLowerCase();
    for (let b = 0; b < o.blocklist.length; b++) {
      const phrase = String(o.blocklist[b] || '').toLowerCase();
      if (phrase && lower.indexOf(phrase) >= 0) {
        reasons.push('blocklist');
        score = Math.max(score, 0.92);
        break;
      }
    }
  }

  if (o.detectUrlFlood) {
    const urls = extractUrls(textBlob);
    const lines = textBlob.split(/\n/).filter(Boolean).length || 1;
    const maxUrls = o.maxUrls || 3;
    if (urls.length >= maxUrls + 1 || (urls.length >= 2 && urls.length / Math.max(lines, 1) > 0.5)) {
      reasons.push('url_flood');
      score = Math.max(score, 0.74);
    }
    if (hasShortLinks(textBlob)) {
      reasons.push('short_link');
      score = Math.max(score, 0.55);
    }
  }

  if (o.detectDisposable !== false && looksDisposableEmail(textBlob)) {
    reasons.push('disposable_email');
    score = Math.max(score, 0.62);
  }

  if (o.detectBait !== false) {
    if (hasBait(textBlob)) {
      reasons.push('bait');
      score = Math.max(score, 0.78);
    }
    if (looksGibberish(textBlob)) {
      reasons.push('gibberish');
      score = Math.max(score, 0.58);
    }
    if (hasMixedScript(textBlob)) {
      reasons.push('mixed_script');
      score = Math.max(score, 0.5);
    }
  }

  const letters = textBlob.replace(/[^A-Za-z]/g, '');
  if (letters.length >= 12) {
    const upper = letters.replace(/[^A-Z]/g, '').length;
    if (upper / letters.length > 0.78) {
      reasons.push('all_caps');
      score = Math.max(score, 0.4);
    }
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length >= 6) {
    const freq: Record<string, number> = {};
    let maxRep = 0;
    tokens.forEach((t) => {
      freq[t] = (freq[t] || 0) + 1;
      if (freq[t] > maxRep) maxRep = freq[t];
    });
    if (maxRep / tokens.length > 0.45) {
      reasons.push('repeated_tokens');
      score = Math.max(score, 0.52);
    }
  }

  const fp = spamFingerprint(fields || textBlob, o);
  const recent = o.recentFingerprints;
  for (let i = 0; i < recent.length; i++) {
    const prev = recent[i];
    const prevFp = typeof prev === 'string' ? prev : prev?.fingerprint;
    const prevNorm = typeof prev === 'object' && prev ? prev.normalized || '' : '';
    if (prevFp && prevFp === fp) {
      reasons.push('burst');
      score = Math.max(score, 0.9);
      break;
    }
    if (prevNorm && normalized) {
      const sim = calculateSimilarity(normalized, prevNorm);
      if (sim >= o.simThreshold) {
        reasons.push('near_duplicate');
        score = Math.max(score, 0.76);
        break;
      }
    }
  }

  const uniq = uniqueReasons(reasons);
  let decision: SpamDecision = 'allow';
  if (score >= o.blockScore) decision = 'block';
  else if (score >= o.softScore) decision = 'soft_reject';

  return {
    score: Math.round(score * 1000) / 1000,
    reasons: uniq,
    decision,
    fingerprint: fp,
    normalized,
    mode: o.mode
  };
}

function formatFields(fields: Record<string, string>): string {
  return Object.keys(fields)
    .map((k) => k + '=' + fields[k])
    .join('\n');
}

function cleanFormPayload(text: string, o: SpamOpts): SpamCleanResult {
  const fields = spamParseFormFields(text);
  const keys = Object.keys(fields);
  if (!keys.length) return cleanLines(text, o);

  const whole = scorePayload(fields, o);
  if (whole.decision === 'block' && whole.reasons.indexOf('honeypot') >= 0) {
    return {
      cleaned: '',
      removedCount: keys.length,
      keptCount: 0,
      removed: keys.map((k, index) => ({
        line: k + '=' + fields[k],
        index,
        reasons: whole.reasons
      })),
      score: whole
    };
  }

  const keptFields: Record<string, string> = {};
  const removed: Array<{ line: string; index: number; reasons: string[] }> = [];
  let idx = 0;
  keys.forEach((k) => {
    const lk = k.toLowerCase();
    const line = k + '=' + fields[k];
    if (o.detectHoneypot && HONEYPOT_FIELDS.indexOf(lk) >= 0) {
      if (String(fields[k] || '').trim()) {
        removed.push({ line, index: idx, reasons: ['honeypot'] });
      }
      idx++;
      return;
    }
    const fieldScore = scorePayload(String(fields[k] || ''), { ...o, mode: 'list' });
    let blockHit = false;
    if (o.blocklist.length) {
      const lower = (k + ' ' + fields[k]).toLowerCase();
      blockHit = o.blocklist.some((p) => p && lower.indexOf(String(p).toLowerCase()) >= 0);
    }
    if (blockHit || fieldScore.decision === 'block') {
      removed.push({
        line,
        index: idx,
        reasons: uniqueReasons(fieldScore.reasons.concat(blockHit ? ['blocklist'] : []))
      });
    } else {
      keptFields[k] = fields[k];
    }
    idx++;
  });

  return {
    cleaned: formatFields(keptFields),
    removedCount: removed.length,
    keptCount: Object.keys(keptFields).length,
    removed,
    score: whole
  };
}

function cleanLines(text: string, o: SpamOpts): SpamCleanResult {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const kept: string[] = [];
  const removed: Array<{ line: string; index: number; reasons: string[] }> = [];
  const keptNorm: string[] = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      kept.push(line);
      return;
    }

    const lineOpts = { ...o, mode: o.mode === 'form' ? ('list' as SpamMode) : o.mode };
    const norm = spamNormalizeText(trimmed, o.stripTrackers);
    const isDup = keptNorm.some((n) => {
      if (n === norm) return true;
      return calculateSimilarity(n, norm) >= o.simThreshold;
    });

    const score = scorePayload(trimmed, {
      ...lineOpts,
      recentFingerprints: keptNorm.map((n) => ({ fingerprint: spamSimpleHash(n), normalized: n }))
    });

    let blocklistHit = false;
    if (o.blocklist.length) {
      const lower = trimmed.toLowerCase();
      blocklistHit = o.blocklist.some((p) => p && lower.indexOf(String(p).toLowerCase()) >= 0);
    }

    let drop = blocklistHit || score.decision === 'block' || (isDup && o.mode !== 'log');
    if (!drop && score.decision === 'soft_reject' && o.mode === 'list') drop = true;
    if (
      !drop &&
      o.mode === 'log' &&
      score.decision === 'soft_reject' &&
      (score.reasons.indexOf('bait') >= 0 || score.reasons.indexOf('url_flood') >= 0)
    ) {
      drop = true;
    }

    if (drop) {
      removed.push({
        line,
        index: idx,
        reasons: uniqueReasons(
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

  return {
    cleaned: kept.join('\n'),
    removedCount: removed.length,
    keptCount: kept.filter((l) => l.trim()).length,
    removed,
    score: scorePayload(text, o)
  };
}

export function cleanText(text: string, opts?: Partial<SpamOpts>): SpamCleanResult {
  const o = spamDefaultOpts(opts);
  if (o.mode === 'form') return cleanFormPayload(text, o);
  return cleanLines(text, o);
}

/** Aliases matching browser global names for parity docs */
export const spamScorePayload = scorePayload;
export const spamCleanText = cleanText;
