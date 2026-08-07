import { requireSession } from '../lib/auth';
import { keyPrefix, mintApiKey, randomToken, sha256Hex } from '../lib/crypto-util';
import { jsonResponse } from '../lib/cors';
import type { Env } from '../lib/env';
import { PLANS, type PlanId } from '../lib/plans';
import { getApiUsage, getUsageHistory, getUser, putUser, tenantIdFromEmail, userPlan } from '../lib/users';
import { formatApiLogLine, readApiLogs } from '../lib/request-log';
import { readJsonBody } from '../lib/validate';

export async function handleAccountRoutes(
  request: Request,
  env: Env,
  path: string
): Promise<Response | null> {
  if (!path.startsWith('/v1/account')) return null;

  const session = await requireSession(request, env);
  if (!session.ok) {
    return jsonResponse({ error: session.error }, 401, request);
  }

  const email = session.email;
  let user = (await getUser(env, email)) || {
    email,
    createdAt: Date.now(),
    keyIds: [],
    plan: 'guest' as PlanId,
    planStatus: 'none',
    emailVerified: false
  };

  if (path === '/v1/account' && request.method === 'GET') {
    const plan = userPlan(user);
    const limits = PLANS[plan].limits;
    const usageTenant = tenantIdFromEmail(email);
    const apiUsed = await getApiUsage(env, usageTenant);
    const history = await getUsageHistory(env, [usageTenant], 7);
    return jsonResponse(
      {
        email,
        plan,
        planName: PLANS[plan].name,
        planStatus: user.planStatus || 'none',
        paid: plan !== 'guest',
        emailVerified: !!user.emailVerified,
        hasPassword: !!user.passwordHash,
        stripeCustomerId: user.stripeCustomerId ? true : false,
        createdAt: user.createdAt,
        limits,
        usage: {
          apiUsedToday: apiUsed,
          apiLimit: limits.apiRequestsPerDay,
          keys: (user.keyIds || []).length,
          maxKeys: limits.maxKeys,
          history
        },
        keys: await listKeys(env, user.keyIds || [])
      },
      200,
      request
    );
  }

  if (path === '/v1/account/keys' && request.method === 'GET') {
    return jsonResponse({ keys: await listKeys(env, user.keyIds || []) }, 200, request);
  }

  if (path === '/v1/account/keys' && request.method === 'POST') {
    const plan = userPlan(user);
    const maxKeys = PLANS[plan].limits.maxKeys;
    if (maxKeys <= 0) {
      return jsonResponse(
        {
          error: 'API keys require a paid Basic plan or higher. Subscribe on Pricing ($5/mo).',
          code: 'plan_required',
          plan
        },
        403,
        request
      );
    }
    if ((user.keyIds || []).length >= maxKeys) {
      return jsonResponse(
        {
          error:
            'Your ' +
            PLANS[plan].name +
            ' plan allows ' +
            maxKeys +
            ' API key' +
            (maxKeys === 1 ? '' : 's') +
            '. Upgrade on Pricing.',
          code: 'key_limit',
          plan
        },
        403,
        request
      );
    }

    if (!user.emailVerified) {
      return jsonResponse(
        { error: 'Verify your email before creating API keys.', code: 'email_unverified' },
        403,
        request
      );
    }

    const parsed = await readJsonBody(request, 8 * 1024);
    if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status, request);
    const label = String(parsed.body.label || 'Default').trim().slice(0, 64) || 'Default';

    const raw = mintApiKey();
    const hash = await sha256Hex(raw);
    const id = randomToken(8);
    const createdAt = Date.now();

    await env.GECKODUPE_SPAM.put(
      'keyhash:' + hash,
      JSON.stringify({ email, keyId: id, id, label, createdAt, revoked: false })
    );
    await env.GECKODUPE_SPAM.put(
      'keymeta:' + id,
      JSON.stringify({
        email,
        id,
        keyId: id,
        label,
        createdAt,
        prefix: keyPrefix(raw),
        hash,
        revoked: false
      })
    );

    user.keyIds = [...(user.keyIds || []), id];
    user.email = email;
    await putUser(env, user);

    return jsonResponse(
      {
        ok: true,
        apiKey: raw,
        key: {
          id,
          label,
          prefix: keyPrefix(raw),
          createdAt,
          secret: raw
        },
        warning: 'Copy this key now. It will not be shown again.'
      },
      201,
      request
    );
  }

  if (path.startsWith('/v1/account/keys/') && request.method === 'DELETE') {
    const id = path.slice('/v1/account/keys/'.length).replace(/\/+$/, '');
    if (!id || !/^[a-f0-9]+$/i.test(id)) {
      return jsonResponse({ error: 'Invalid key id' }, 400, request);
    }
    if (!(user.keyIds || []).includes(id)) {
      return jsonResponse({ error: 'Key not found' }, 404, request);
    }
    const metaRaw = await env.GECKODUPE_SPAM.get('keymeta:' + id);
    if (metaRaw) {
      try {
        const meta = JSON.parse(metaRaw);
        meta.revoked = true;
        await env.GECKODUPE_SPAM.put('keymeta:' + id, JSON.stringify(meta));
        if (meta.hash) {
          const kh = await env.GECKODUPE_SPAM.get('keyhash:' + meta.hash);
          if (kh) {
            const parsed = JSON.parse(kh);
            parsed.revoked = true;
            await env.GECKODUPE_SPAM.put('keyhash:' + meta.hash, JSON.stringify(parsed));
          }
        }
      } catch {
        /* ignore */
      }
    }
    user.keyIds = (user.keyIds || []).filter((x) => x !== id);
    await putUser(env, user);
    return jsonResponse({ ok: true }, 200, request);
  }

  if (path === '/v1/account/logs' && request.method === 'GET') {
    const logs = await readApiLogs(env, email);
    const lines = logs.map(formatApiLogLine);
    return jsonResponse(
      {
        logs,
        lines,
        count: logs.length
      },
      200,
      request
    );
  }

  // Legacy body-based revoke
  if (path === '/v1/account/keys' && request.method === 'DELETE') {
    const parsed = await readJsonBody(request, 8 * 1024);
    if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status, request);
    const id = String(parsed.body.id || '').trim();
    if (!id) return jsonResponse({ error: 'Key id required' }, 400, request);
    const delReq = new Request(new URL('/v1/account/keys/' + id, request.url).toString(), {
      method: 'DELETE',
      headers: request.headers
    });
    return handleAccountRoutes(delReq, env, '/v1/account/keys/' + id);
  }

  return jsonResponse({ error: 'Not found' }, 404, request);
}

async function listKeys(env: Env, ids: string[]) {
  const out: Array<{ id: string; label: string; prefix: string; createdAt: number; revoked?: boolean }> = [];
  for (const id of ids) {
    const raw = await env.GECKODUPE_SPAM.get('keymeta:' + id);
    if (!raw) continue;
    try {
      const meta = JSON.parse(raw);
      out.push({
        id: meta.id,
        label: meta.label,
        prefix: meta.prefix,
        createdAt: meta.createdAt,
        revoked: !!meta.revoked
      });
    } catch {
      /* ignore */
    }
  }
  return out;
}
