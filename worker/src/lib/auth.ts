import { sha256Hex } from './crypto-util.ts';
import type { Env } from './env.ts';

export function parseApiKeys(raw: string | undefined): Set<string> {
  const set = new Set<string>();
  if (!raw) return set;
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, string>;
      Object.values(obj).forEach((v) => {
        if (v) set.add(String(v));
      });
      return set;
    } catch {
      /* fall through */
    }
  }
  trimmed.split(/[,\s]+/).forEach((k) => {
    if (k) set.add(k);
  });
  return set;
}

export function extractBearerToken(request: Request): string {
  const auth = request.headers.get('Authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

/** Stable tenant id from API key (never store raw keys in KV paths). */
export function tenantIdFromKey(token: string): string {
  const s = token || 'anonymous';
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 't' + (h >>> 0).toString(16);
}

export type AuthOk = { ok: true; token: string; tenant: string; email?: string };
export type AuthFail = { ok: false; error: string };

export async function requireApiKey(request: Request, env: Env): Promise<AuthOk | AuthFail> {
  const token = extractBearerToken(request);
  const staticKeys = parseApiKeys(env.API_KEYS);

  if (token && staticKeys.has(token)) {
    return { ok: true, token, tenant: tenantIdFromKey(token) };
  }

  if (token && token.indexOf('gd_') === 0) {
    try {
      const hash = await sha256Hex(token);
      const meta = (await env.GECKODUPE_SPAM.get('keyhash:' + hash, 'json')) as
        | { keyId?: string; email?: string; revoked?: boolean }
        | null;
      const keyId = meta && (meta.keyId || (meta as { id?: string }).id);
      if (meta && keyId && !meta.revoked) {
        return {
          ok: true,
          token,
          tenant: tenantIdFromKey(token),
          email: meta.email
        };
      }
    } catch {
      /* fall through */
    }
  }

  // Open demo only when explicitly enabled (never default in production)
  if (staticKeys.size === 0 && (env.ALLOW_OPEN_API === '1' || env.ALLOW_OPEN_API === 'true')) {
    const effective = token || 'dev';
    return { ok: true, token: effective, tenant: tenantIdFromKey(effective) };
  }

  if (!token) return { ok: false, error: 'Unauthorized' };
  return { ok: false, error: 'Unauthorized' };
}

export type SessionOk = { ok: true; sessionId: string; email: string };
export type SessionFail = { ok: false; error: string };

export async function requireSession(request: Request, env: Env): Promise<SessionOk | SessionFail> {
  const token = extractBearerToken(request);
  if (!token || token.indexOf('sess_') !== 0) {
    return { ok: false, error: 'Sign in required' };
  }
  try {
    const session = (await env.GECKODUPE_SPAM.get('session:' + token, 'json')) as
      | { email?: string; exp?: number }
      | null;
    if (!session || !session.email) return { ok: false, error: 'Sign in required' };
    if (session.exp && session.exp < Date.now()) {
      await env.GECKODUPE_SPAM.delete('session:' + token);
      return { ok: false, error: 'Session expired' };
    }
    return { ok: true, sessionId: token, email: String(session.email).toLowerCase() };
  } catch {
    return { ok: false, error: 'Sign in required' };
  }
}

export function normalizeEmail(email: string): string | null {
  const e = String(email || '')
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 254) return null;
  return e;
}
