import { requireSession } from '../lib/auth';
import { jsonResponse } from '../lib/cors';
import type { Env } from '../lib/env';
import { PLANS, PUBLIC_PLAN_IDS, planFromPriceId, type PlanId } from '../lib/plans';
import { getPriceIds, stripeRequest, verifyStripeSignature } from '../lib/stripe';
import { getApiUsage, getUsageHistory, getUser, putUser, tenantIdFromEmail, userPlan } from '../lib/users';
import { readJsonBody } from '../lib/validate';

function appOrigin(env: Env): string {
  return (env.APP_ORIGIN || 'https://gekodupe.github.io/Gekodupe').replace(/\/+$/, '');
}

async function ensureStripeCustomer(env: Env, email: string, user: any): Promise<string | null> {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const created = await stripeRequest(env, 'POST', '/customers', {
    email,
    'metadata[geckodupe_email]': email
  });
  if (!created.ok) return null;
  user.stripeCustomerId = created.data.id;
  await putUser(env, user);
  return user.stripeCustomerId as string;
}

async function applyPlanToEmail(env: Env, email: string, plan: PlanId, status: string, subId?: string) {
  const user = (await getUser(env, email)) || { email, createdAt: Date.now(), keyIds: [] };
  user.email = email;
  user.plan = plan;
  user.planStatus = status;
  if (subId) user.stripeSubscriptionId = subId;
  await putUser(env, user);
}

export async function handleBillingRoutes(
  request: Request,
  env: Env,
  path: string
): Promise<Response | null> {
  if (!path.startsWith('/v1/billing')) return null;

  if (path === '/v1/billing/plans' && request.method === 'GET') {
    const prices = getPriceIds(env);
    const list = PUBLIC_PLAN_IDS.map((id) => ({
      ...PLANS[id],
      priceId: prices[id] || null
    }));
    return jsonResponse({ plans: list }, 200, request);
  }

  if (path === '/v1/billing/webhook' && request.method === 'POST') {
    const payload = await request.text();
    const sig = request.headers.get('Stripe-Signature');
    if (!env.STRIPE_WEBHOOK_SECRET) {
      return jsonResponse({ error: 'Webhook not configured' }, 503, request);
    }
    const valid = await verifyStripeSignature(payload, sig, env.STRIPE_WEBHOOK_SECRET);
    if (!valid) return jsonResponse({ error: 'Invalid signature' }, 400, request);

    let event: any;
    try {
      event = JSON.parse(payload);
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400, request);
    }

    const prices = getPriceIds(env);
    const type = event.type as string;
    const obj = event.data && event.data.object;

    if (type === 'checkout.session.completed' && obj) {
      const email = String(obj.customer_email || obj.client_reference_id || obj.metadata?.geckodupe_email || '')
        .trim()
        .toLowerCase();
      const planMeta = (obj.metadata && obj.metadata.plan) as string | undefined;
      const plan: PlanId =
        planMeta === 'free' || planMeta === 'starter' || planMeta === 'pro' || planMeta === 'business'
          ? planMeta
          : 'free';
      if (email) {
        const user = (await getUser(env, email)) || { email, createdAt: Date.now(), keyIds: [] };
        if (obj.customer) {
          user.stripeCustomerId = obj.customer;
          await env.GECKODUPE_SPAM.put('stripe_customer:' + obj.customer, email);
        }
        if (obj.subscription) user.stripeSubscriptionId = obj.subscription;
        user.plan = plan;
        user.planStatus = 'active';
        user.email = email;
        await putUser(env, user);
      }
    }

    if ((type === 'customer.subscription.updated' || type === 'customer.subscription.deleted') && obj) {
      const customerId = obj.customer as string;
      const email = await env.GECKODUPE_SPAM.get('stripe_customer:' + customerId);
      const priceId =
        obj.items && obj.items.data && obj.items.data[0] && obj.items.data[0].price
          ? obj.items.data[0].price.id
          : '';
      const plan = planFromPriceId(priceId, prices);
      if (email) {
        if (type === 'customer.subscription.deleted') {
          await applyPlanToEmail(env, email, 'guest', 'canceled', obj.id);
        } else {
          await applyPlanToEmail(env, email, plan, obj.status || 'active', obj.id);
        }
      }
    }

    if (type === 'invoice.paid' && obj && obj.customer) {
      const email = await env.GECKODUPE_SPAM.get('stripe_customer:' + obj.customer);
      if (email) {
        const user = await getUser(env, email);
        if (user) {
          user.planStatus = 'active';
          await putUser(env, user);
        }
      }
    }

    if (type === 'invoice.payment_failed' && obj && obj.customer) {
      const email = await env.GECKODUPE_SPAM.get('stripe_customer:' + obj.customer);
      if (email) {
        const user = await getUser(env, email);
        if (user) {
          user.planStatus = 'past_due';
          await putUser(env, user);
        }
      }
    }

    return jsonResponse({ received: true }, 200, request);
  }

  const session = await requireSession(request, env);
  if (!session.ok) return jsonResponse({ error: session.error }, 401, request);
  const email = session.email;
  let user = (await getUser(env, email)) || { email, createdAt: Date.now(), keyIds: [], plan: 'guest', planStatus: 'none' };

  if (path === '/v1/billing/usage' && request.method === 'GET') {
    const plan = userPlan(user);
    const usageTenant = tenantIdFromEmail(email);
    const used = await getApiUsage(env, usageTenant);
    const history = await getUsageHistory(env, [usageTenant], 7);
    return jsonResponse(
      {
        plan,
        planStatus: user.planStatus || 'none',
        limits: PLANS[plan].limits,
        apiUsedToday: used,
        apiLimit: PLANS[plan].limits.apiRequestsPerDay,
        history
      },
      200,
      request
    );
  }

  if (path === '/v1/billing/checkout' && request.method === 'POST') {
    const parsed = await readJsonBody(request, 8 * 1024);
    if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status, request);
    const plan = String(parsed.body.plan || '');
    if (plan !== 'free' && plan !== 'starter' && plan !== 'pro') {
      return jsonResponse({ error: 'Choose free, starter, or pro' }, 400, request);
    }
    const prices = getPriceIds(env);
    const priceId = prices[plan];
    if (!priceId) return jsonResponse({ error: 'Price not configured' }, 503, request);

    const customerId = await ensureStripeCustomer(env, email, user);
    if (customerId) {
      await env.GECKODUPE_SPAM.put('stripe_customer:' + customerId, email);
      user = (await getUser(env, email)) || user;
    }

    const origin = appOrigin(env);
    const sessionRes = await stripeRequest(env, 'POST', '/checkout/sessions', {
      mode: 'subscription',
      customer: customerId || undefined,
      customer_email: customerId ? undefined : email,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: origin + '/#pricing?checkout=success',
      cancel_url: origin + '/#pricing?checkout=cancel',
      client_reference_id: email,
      'metadata[geckodupe_email]': email,
      'metadata[plan]': plan,
      'subscription_data[metadata][geckodupe_email]': email,
      'subscription_data[metadata][plan]': plan
    });

    if (!sessionRes.ok) {
      return jsonResponse({ error: sessionRes.error }, sessionRes.status, request);
    }
    return jsonResponse({ ok: true, url: sessionRes.data.url, id: sessionRes.data.id }, 200, request);
  }

  if (path === '/v1/billing/portal' && request.method === 'POST') {
    user = (await getUser(env, email)) || user;
    const customerId = await ensureStripeCustomer(env, email, user);
    if (!customerId) return jsonResponse({ error: 'Could not open billing portal' }, 502, request);
    await env.GECKODUPE_SPAM.put('stripe_customer:' + customerId, email);
    const origin = appOrigin(env);
    const portal = await stripeRequest(env, 'POST', '/billing_portal/sessions', {
      customer: customerId,
      return_url: origin + '/#account'
    });
    if (!portal.ok) return jsonResponse({ error: portal.error }, portal.status, request);
    return jsonResponse({ ok: true, url: portal.data.url }, 200, request);
  }

  return jsonResponse({ error: 'Not found' }, 404, request);
}
