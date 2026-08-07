import type { Env } from './env';
import { tenantIdFromEmail } from './users';

export type ApiLogEntry = {
  ts: number;
  path: string;
  method: string;
  status: number;
  decision?: string;
  score?: number;
  duplicate?: boolean;
  detail?: string;
};

const MAX_LOGS = 100;
const LOG_TTL_SEC = 60 * 60 * 24 * 7;

function logKey(email: string | undefined, tenant: string): string {
  const id = email ? tenantIdFromEmail(email) : tenant;
  return 'apilog:' + id;
}

export async function readApiLogs(env: Env, email: string | undefined, tenant?: string): Promise<ApiLogEntry[]> {
  const key = logKey(email, tenant || 'unknown');
  try {
    const raw = await env.GECKODUPE_SPAM.get(key, 'json');
    if (Array.isArray(raw)) return raw as ApiLogEntry[];
  } catch {
    /* empty */
  }
  return [];
}

export async function appendApiLog(
  env: Env,
  opts: {
    email?: string;
    tenant: string;
    path: string;
    method?: string;
    status?: number;
    decision?: string;
    score?: number;
    duplicate?: boolean;
    detail?: string;
  }
): Promise<void> {
  try {
    const key = logKey(opts.email, opts.tenant);
    const list = await readApiLogs(env, opts.email, opts.tenant);
    const entry: ApiLogEntry = {
      ts: Date.now(),
      path: String(opts.path || '').slice(0, 120),
      method: String(opts.method || 'POST').slice(0, 12),
      status: Number(opts.status) || 200
    };
    if (opts.decision) entry.decision = String(opts.decision).slice(0, 40);
    if (typeof opts.score === 'number' && Number.isFinite(opts.score)) {
      entry.score = Math.round(opts.score * 1000) / 1000;
    }
    if (opts.duplicate) entry.duplicate = true;
    if (opts.detail) entry.detail = String(opts.detail).slice(0, 80);
    const next = [entry, ...list].slice(0, MAX_LOGS);
    await env.GECKODUPE_SPAM.put(key, JSON.stringify(next), { expirationTtl: LOG_TTL_SEC });
  } catch {
    /* never break API responses for logging */
  }
}

/** One line per entry for display + Geckodupe log dedupe. */
export function formatApiLogLine(entry: ApiLogEntry): string {
  const iso = new Date(entry.ts || Date.now()).toISOString();
  const parts = [iso, entry.method || 'POST', entry.path || '?', 'status=' + (entry.status || 0)];
  if (entry.decision) parts.push('decision=' + entry.decision);
  if (typeof entry.score === 'number') parts.push('score=' + entry.score);
  if (entry.duplicate) parts.push('duplicate=true');
  if (entry.detail) parts.push(entry.detail);
  return parts.join(' ');
}
