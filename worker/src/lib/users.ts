import type { Env } from './env.ts';
import { PLANS, normalizePlan, type PlanId } from './plans.ts';

export async function getUser(env: Env, email: string): Promise<any | null> {
  return (await env.GECKODUPE_SPAM.get('user:' + email, 'json')) as any;
}

export async function putUser(env: Env, user: any): Promise<void> {
  await env.GECKODUPE_SPAM.put('user:' + user.email, JSON.stringify(user));
}

export function userPlan(user: any | null): PlanId {
  if (!user) return 'guest';
  const plan = normalizePlan(user.plan);
  const status = String(user.planStatus || 'none');
  const paidStatus = status === 'active' || status === 'trialing';
  // Basic ($5) and higher require an active Stripe subscription. Unpaid accounts stay Guest (no API keys).
  const hasStripe = !!user.stripeSubscriptionId;
  if (!paidStatus || !hasStripe || plan === 'guest') return 'guest';
  return plan;
}

export function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export async function incrementApiUsage(env: Env, tenant: string): Promise<number> {
  const key = 'usage:' + tenant + ':' + dayKey();
  const cur = Number((await env.GECKODUPE_SPAM.get(key)) || '0') || 0;
  const next = cur + 1;
  await env.GECKODUPE_SPAM.put(key, String(next), { expirationTtl: 60 * 60 * 24 * 14 });
  return next;
}

export async function getApiUsage(env: Env, tenant: string, day?: string): Promise<number> {
  const key = 'usage:' + tenant + ':' + (day || dayKey());
  return Number((await env.GECKODUPE_SPAM.get(key)) || '0') || 0;
}

export function recentDayKeys(days = 7): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    out.push(dayKey(d));
  }
  return out;
}

export async function getUsageHistory(
  env: Env,
  tenants: string[],
  days = 7
): Promise<Array<{ day: string; used: number }>> {
  const keys = recentDayKeys(days);
  const history: Array<{ day: string; used: number }> = [];
  for (const day of keys) {
    let used = 0;
    for (const tenant of tenants) {
      used += await getApiUsage(env, tenant, day);
    }
    history.push({ day, used });
  }
  return history;
}

export async function enforceApiQuota(
  env: Env,
  opts: { tenant: string; email?: string; plan?: PlanId }
): Promise<{ ok: true; used: number; limit: number; plan: PlanId } | { ok: false; error: string; status: number; plan: PlanId; used: number; limit: number }> {
  let plan: PlanId = opts.plan || 'guest';
  if (opts.email) {
    const user = await getUser(env, opts.email);
    plan = userPlan(user);
  }
  const limit = PLANS[plan].limits.apiRequestsPerDay;
  // Account-scoped quota when email is known (shared across all keys)
  const usageTenant = opts.email ? tenantIdFromEmail(opts.email) : opts.tenant;
  const used = await getApiUsage(env, usageTenant);
  if (used >= limit) {
    return {
      ok: false,
      error: 'Daily API quota reached for plan ' + plan + ' (' + limit + '/day). Upgrade on the Pricing tab.',
      status: 429,
      plan,
      used,
      limit
    };
  }
  const next = await incrementApiUsage(env, usageTenant);
  return { ok: true, used: next, limit, plan };
}

export function tenantIdFromEmail(email: string): string {
  const s = 'acct:' + String(email || '').toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 't' + (h >>> 0).toString(16);
}
