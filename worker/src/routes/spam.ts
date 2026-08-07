import { cleanText, scorePayload, spamDefaultOpts, type SpamOpts, type SpamScoreResult } from '../lib/spam-engine';
import { requireApiKey, type AuthOk } from '../lib/auth';
import { jsonResponse } from '../lib/cors';
import type { Env } from '../lib/env';
import { verifyTurnstile } from '../lib/turnstile';
import { enforceApiQuota } from '../lib/users';
import { hasSpamInput, readJsonBody, sanitizeBlocklist } from '../lib/validate';

export type { Env };

interface RateLimit {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

function clientKey(request: Request, auth?: AuthOk): string {
  if (auth?.tenant) return 'tenant:' + auth.tenant;
  const token = request.headers.get('Authorization') || '';
  if (token) return 'auth:' + token.slice(0, 48);
  return 'ip:' + (request.headers.get('CF-Connecting-IP') || 'unknown');
}

async function applyRateLimit(env: Env, request: Request, auth?: AuthOk): Promise<boolean> {
  if (!env.SPAM_RATE_LIMITER) return true;
  try {
    const r = await env.SPAM_RATE_LIMITER.limit({ key: clientKey(request, auth) });
    return r.success;
  } catch {
    return false;
  }
}

function emit(env: Env, blobs: string[], doubles?: number[]) {
  try {
    env.ANALYTICS?.writeDataPoint({
      blobs,
      doubles: doubles || [],
      indexes: [blobs[0] || 'spam']
    });
  } catch {
    /* ignore */
  }
}

function parseOptions(body: Record<string, unknown>): Partial<SpamOpts> {
  const raw = (body.options || body.opts || {}) as Partial<SpamOpts> & { blocklist?: string | string[] };
  return spamDefaultOpts(raw);
}

async function readRecent(
  env: Env,
  tenant: string
): Promise<Array<{ fingerprint: string; normalized: string }>> {
  try {
    const raw = await env.GECKODUPE_SPAM.get(`recent:${tenant}`, 'json');
    if (Array.isArray(raw)) return raw as Array<{ fingerprint: string; normalized: string }>;
  } catch {
    /* empty */
  }
  return [];
}

async function pushRecent(
  env: Env,
  tenant: string,
  entry: { fingerprint: string; normalized: string },
  windowMs: number
): Promise<void> {
  const list = await readRecent(env, tenant);
  const next = [{ ...entry, ts: Date.now() }, ...list].slice(0, 40);
  await env.GECKODUPE_SPAM.put(`recent:${tenant}`, JSON.stringify(next), {
    expirationTtl: Math.max(60, Math.ceil(windowMs / 1000) * 2)
  });
}

async function readBlocklist(env: Env, tenant: string): Promise<string[]> {
  try {
    const scoped = (await env.GECKODUPE_SPAM.get(`blocklist:${tenant}`, 'json')) as string[] | null;
    if (Array.isArray(scoped)) return scoped;
    const legacy = (await env.GECKODUPE_SPAM.get('blocklist', 'json')) as string[] | null;
    if (Array.isArray(legacy)) return legacy;
  } catch {
    /* empty */
  }
  return [];
}

export async function handleSpamRoutes(request: Request, env: Env, path: string): Promise<Response | null> {
  if (!path.startsWith('/v1/spam/')) return null;

  const auth = await requireApiKey(request, env);
  if (!auth.ok) return jsonResponse({ error: auth.error }, 401, request);

  if (!(await applyRateLimit(env, request, auth))) {
    emit(env, ['rate_limited', path, auth.tenant]);
    return jsonResponse({ error: 'Rate limit exceeded' }, 429, request);
  }

  const quota = await enforceApiQuota(env, {
    tenant: auth.tenant,
    email: auth.email,
    plan: auth.email ? undefined : 'business'
  });
  if (!quota.ok) {
    emit(env, ['quota', path, auth.tenant, quota.plan]);
    return jsonResponse(
      { error: quota.error, code: 'quota', plan: quota.plan, used: quota.used, limit: quota.limit },
      quota.status,
      request
    );
  }

  if (path === '/v1/spam/blocklist' && (request.method === 'GET' || request.method === 'PUT')) {
    if (request.method === 'GET') {
      const list = await readBlocklist(env, auth.tenant);
      return jsonResponse({ blocklist: list }, 200, request);
    }

    const parsed = await readJsonBody(request);
    if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status, request);
    const bl = sanitizeBlocklist(parsed.body.blocklist);
    if (!bl.ok) return jsonResponse({ error: bl.error }, 400, request);
    await env.GECKODUPE_SPAM.put(`blocklist:${auth.tenant}`, JSON.stringify(bl.blocklist));
    emit(env, ['blocklist_update', auth.tenant, String(bl.blocklist.length)]);
    return jsonResponse({ ok: true, count: bl.blocklist.length }, 200, request);
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, request);
  }

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status, request);
  const body = parsed.body;

  if (path !== '/v1/spam/check' && !hasSpamInput(body)) {
    return jsonResponse({ error: 'Provide text, payload, or fields' }, 400, request);
  }

  const text = String(body.text || body.payload || '');
  const fields = body.fields && typeof body.fields === 'object' && !Array.isArray(body.fields)
    ? (body.fields as Record<string, string>)
    : null;
  const options = parseOptions(body);
  const kvBlock = await readBlocklist(env, auth.tenant);
  if (kvBlock.length) {
    options.blocklist = [...(options.blocklist || []), ...kvBlock];
  }

  if (path === '/v1/spam/score') {
    const input = fields || text;
    const result = scorePayload(input, options);
    emit(env, ['score', result.decision, ...result.reasons], [result.score]);
    return jsonResponse(result, 200, request);
  }

  if (path === '/v1/spam/clean') {
    if (!text && !fields) {
      return jsonResponse({ error: 'Provide text to clean' }, 400, request);
    }
    const cleaned = cleanText(text || JSON.stringify(fields || {}), options);
    emit(env, ['clean', cleaned.score.decision], [cleaned.removedCount, cleaned.keptCount]);
    return jsonResponse(cleaned, 200, request);
  }

  if (path === '/v1/spam/check') {
    if (!hasSpamInput(body)) {
      return jsonResponse({ error: 'Provide text, payload, or fields' }, 400, request);
    }
    const turnstile = await verifyTurnstile(
      body.turnstileToken as string | undefined,
      env.TURNSTILE_SECRET,
      request.headers.get('CF-Connecting-IP')
    );
    if (!turnstile.ok) {
      return jsonResponse({ error: 'Turnstile failed', reason: turnstile.reason }, 403, request);
    }

    const tenant = auth.tenant;
    const recent = await readRecent(env, tenant);
    options.recentFingerprints = recent;
    const input = fields || text;
    const score: SpamScoreResult = scorePayload(input, options);
    const cleaned = cleanText(text || JSON.stringify(fields || {}), options);

    if (body.remember !== false) {
      await pushRecent(
        env,
        tenant,
        { fingerprint: score.fingerprint, normalized: score.normalized },
        options.burstWindowMs || 120000
      );
    }

    const burst = score.reasons.indexOf('burst') >= 0 || score.reasons.indexOf('near_duplicate') >= 0;
    emit(env, ['check', score.decision, burst ? 'burst' : 'ok'], [score.score]);
    return jsonResponse({ score, cleaned: cleaned.cleaned, burst, turnstile }, 200, request);
  }

  return jsonResponse({ error: 'Not found' }, 404, request);
}
