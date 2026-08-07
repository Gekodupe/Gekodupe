export interface Env {
  GECKODUPE_SPAM: KVNamespace;
  SPAM_RATE_LIMITER?: {
    limit(opts: { key: string }): Promise<{ success: boolean }>;
  };
  ANALYTICS?: AnalyticsEngineDataset;
  API_KEYS?: string;
  TURNSTILE_SECRET?: string;
  BREVO_API_KEY?: string;
  BREVO_SENDER_EMAIL?: string;
  BREVO_SENDER_NAME?: string;
  APP_ORIGIN?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_PRICE_IDS?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}
