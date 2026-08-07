import { scorePayload, spamDefaultOpts, type SpamOpts } from '../lib/spam-engine';
import { requireApiKey, type AuthOk } from '../lib/auth';
import { jsonResponse } from '../lib/cors';
import type { Env } from '../lib/env';
import { enforceApiQuota } from '../lib/users';
import { appendApiLog } from '../lib/request-log';
import { hasSpamInput, readJsonBody, sanitizeEventId } from '../lib/validate';

function rateKey(auth: AuthOk): string {
  return 'tenant:' + auth.tenant;
}

async function applyRateLimit(env: Env, auth: AuthOk): Promise<boolean> {
  if (!env.SPAM_RATE_LIMITER) return true;
  try {
    const r = await env.SPAM_RATE_LIMITER.limit({ key: rateKey(auth) });
    return r.success;
  } catch {
    return true;
  }
}

async function readRecent(
  env: Env,
  tenant: string
): Promise<Array<{ fingerprint: string; normalized: string; ts?: number }>> {
  try {
    const raw = await env.GECKODUPE_SPAM.get(`recent:${tenant}`, 'json');
    if (Array.isArray(raw)) return raw as Array<{ fingerprint: string; normalized: string; ts?: number }>;
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
  const next = [{ ...entry, ts: Date.now() }, ...list].slice(0, 80);
  await env.GECKODUPE_SPAM.put(`recent:${tenant}`, JSON.stringify(next), {
    expirationTtl: Math.max(60, Math.ceil(windowMs / 1000) * 2)
  });
}

function parseOptions(body: Record<string, unknown>): Partial<SpamOpts> {
  const raw = (body.options || body.opts || {}) as Partial<SpamOpts>;
  return spamDefaultOpts(raw);
}

/**
 * Idempotency / event dedupe for double-submit, retries, webhooks, refresh storms.
 * POST /v1/events/check
 */
export async function handleEventRoutes(request: Request, env: Env, path: string): Promise<Response | null> {
  if (!path.startsWith('/v1/events/')) return null;

  const auth = await requireApiKey(request, env);
  if (!auth.ok) return jsonResponse({ error: auth.error }, 401, request);

  if (!(await applyRateLimit(env, auth))) {
    return jsonResponse({ error: 'Rate limit exceeded' }, 429, request);
  }

  const quota = await enforceApiQuota(env, {
    tenant: auth.tenant,
    email: auth.email,
    plan: auth.email ? undefined : 'guest'
  });
  if (!quota.ok) {
    return jsonResponse(
      { error: quota.error, code: 'quota', plan: quota.plan, used: quota.used, limit: quota.limit },
      quota.status,
      request
    );
  }

  if (path !== '/v1/events/check' || request.method !== 'POST') {
    if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, request);
    return jsonResponse({ error: 'Not found', hint: 'POST /v1/events/check' }, 404, request);
  }

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status, request);
  const body = parsed.body;

  if (!hasSpamInput(body)) {
    return jsonResponse(
      { error: 'Provide text, payload, fields, or eventId' },
      400,
      request
    );
  }

  const text = String(body.text || body.payload || '');
  const fields =
    body.fields && typeof body.fields === 'object' && !Array.isArray(body.fields)
      ? (body.fields as Record<string, string>)
      : null;
  const idCheck = sanitizeEventId(body.eventId);
  if (!idCheck.ok) return jsonResponse({ error: idCheck.error }, 400, request);
  const eventId = idCheck.eventId;

  const options = parseOptions(body);
  const windowMs = options.burstWindowMs || 120000;

  const recent = await readRecent(env, auth.tenant);
  options.recentFingerprints = recent;

  const input = fields || text || (eventId ? { eventId } : '');
  const score = scorePayload(input, options);

  let duplicate = false;
  if (eventId) {
    const idKey = `event:${auth.tenant}:${eventId}`;
    const existing = await env.GECKODUPE_SPAM.get(idKey);
    if (existing) {
      duplicate = true;
    } else if (body.remember !== false) {
      await env.GECKODUPE_SPAM.put(idKey, score.fingerprint, {
        expirationTtl: Math.max(60, Math.ceil(windowMs / 1000))
      });
    }
  }

  if (!duplicate) {
    duplicate =
      score.reasons.indexOf('burst') >= 0 || score.reasons.indexOf('near_duplicate') >= 0;
  }

  if (!duplicate && body.remember !== false) {
    await pushRecent(
      env,
      auth.tenant,
      { fingerprint: score.fingerprint, normalized: score.normalized },
      windowMs
    );
  }

  let decision = score.decision;
  if (duplicate && decision === 'allow') decision = 'soft_reject';

  await appendApiLog(env, {
    email: auth.email,
    tenant: auth.tenant,
    path,
    status: 200,
    decision,
    score: score.score,
    duplicate,
    detail: eventId ? 'eventId' : (score.reasons || []).slice(0, 3).join(',')
  });

  return jsonResponse(
    {
      duplicate,
      decision,
      fingerprint: score.fingerprint,
      score: score.score,
      reasons: duplicate
        ? Array.from(new Set([...(score.reasons || []), 'duplicate_event']))
        : score.reasons,
      normalized: score.normalized,
      mode: score.mode,
      eventId: eventId || null
    },
    200,
    request
  );
}
