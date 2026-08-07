export type PlanId = 'guest' | 'free' | 'starter' | 'pro' | 'business';

export interface PlanLimits {
  apiRequestsPerDay: number;
  maxKeys: number;
  textMaxLines: number;
  textRunsPerDay: number;
  folderMaxFiles: number;
  mediaMaxFiles: number;
  spamMaxLines: number;
  spamRunsPerDay: number;
}

export interface PlanInfo {
  id: PlanId;
  name: string;
  priceMonthly: number;
  blurb: string;
  limits: PlanLimits;
  features: string[];
}

export const PLANS: Record<PlanId, PlanInfo> = {
  guest: {
    id: 'guest',
    name: 'Guest',
    priceMonthly: 0,
    blurb: 'Try the local tools with soft limits.',
    limits: {
      apiRequestsPerDay: 0,
      maxKeys: 0,
      textMaxLines: 2000,
      textRunsPerDay: 5,
      folderMaxFiles: 40,
      mediaMaxFiles: 25,
      spamMaxLines: 1000,
      spamRunsPerDay: 5
    },
    features: ['Local normalize & dedupe', 'Soft daily caps', 'Sign in to unlock more']
  },
  free: {
    id: 'free',
    name: 'Free',
    priceMonthly: 5,
    blurb: 'Signed-in local tools plus a starter API allowance.',
    limits: {
      apiRequestsPerDay: 1500,
      maxKeys: 3,
      textMaxLines: 25000,
      textRunsPerDay: 50,
      folderMaxFiles: 500,
      mediaMaxFiles: 200,
      spamMaxLines: 20000,
      spamRunsPerDay: 50
    },
    features: ['Higher local limits', '3 API keys', '1500 API requests / day', 'Event idempotency']
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 19,
    blurb: 'For indie apps and small form volumes.',
    limits: {
      apiRequestsPerDay: 25000,
      maxKeys: 5,
      textMaxLines: 100000,
      textRunsPerDay: 500,
      folderMaxFiles: 5000,
      mediaMaxFiles: 2000,
      spamMaxLines: 100000,
      spamRunsPerDay: 500
    },
    features: ['25k API requests / day', '5 API keys', 'Priority email support']
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 49,
    blurb: 'Production spam prevention and idempotency.',
    limits: {
      apiRequestsPerDay: 200000,
      maxKeys: 10,
      textMaxLines: 500000,
      textRunsPerDay: 5000,
      folderMaxFiles: 25000,
      mediaMaxFiles: 10000,
      spamMaxLines: 500000,
      spamRunsPerDay: 5000
    },
    features: ['200k API requests / day', '10 API keys', 'Burst memory', 'Checkout portal']
  },
  // Kept for existing Stripe subscriptions; not shown in Pricing UI
  business: {
    id: 'business',
    name: 'Business',
    priceMonthly: 149,
    blurb: 'High-volume teams and multi-project keys.',
    limits: {
      apiRequestsPerDay: 1000000,
      maxKeys: 25,
      textMaxLines: 2000000,
      textRunsPerDay: 50000,
      folderMaxFiles: 100000,
      mediaMaxFiles: 50000,
      spamMaxLines: 2000000,
      spamRunsPerDay: 50000
    },
    features: ['1M API requests / day', '25 API keys', 'Highest local caps', 'Team-ready']
  }
};

export const PUBLIC_PLAN_IDS: PlanId[] = ['free', 'starter', 'pro'];

export function parsePriceIds(raw: string | undefined): Record<string, string> {
  const defaults = {
    free: 'price_1U1eRCGrsdJU1djqi8mF21Fw',
    starter: 'price_1U1dxXGrsdJU1djqpVvONZKS',
    pro: 'price_1U1dxZGrsdJU1djqZaZ3dTdL',
    business: 'price_1U1dxbGrsdJU1djqptRwdqEM'
  };
  if (!raw) return defaults;
  try {
    const obj = JSON.parse(raw) as Record<string, string>;
    return {
      free: obj.free || defaults.free,
      starter: obj.starter || defaults.starter,
      pro: obj.pro || defaults.pro,
      business: obj.business || defaults.business
    };
  } catch {
    return defaults;
  }
}

export function planFromPriceId(priceId: string, priceMap: Record<string, string>): PlanId {
  for (const [plan, id] of Object.entries(priceMap)) {
    if (id === priceId) return plan as PlanId;
  }
  return 'free';
}

export function normalizePlan(plan: string | undefined | null): PlanId {
  if (plan === 'starter' || plan === 'pro' || plan === 'business' || plan === 'free' || plan === 'guest') {
    return plan;
  }
  return 'free';
}
