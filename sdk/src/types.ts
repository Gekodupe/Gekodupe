export const DEFAULT_API_BASE = 'https://geckodupe-spam.nic-58f.workers.dev';

export type SpamMode = 'form' | 'list' | 'log';
export type SpamDecision = 'allow' | 'soft_reject' | 'block';

export interface ClientOptions {
  /** Geckodupe API key (Bearer). Required for hosted calls when the API has keys configured. */
  apiKey: string;
  /** Hosted API base URL. Defaults to the official Geckodupe API. */
  baseUrl?: string;
  /** Optional fetch implementation (Node <18 polyfill, tests, Workers). */
  fetch?: typeof fetch;
  /** Request timeout in ms (default 30000). */
  timeoutMs?: number;
  /** Optional abort signal merged with the timeout controller. */
  signal?: AbortSignal;
}

export interface ScoreRequest {
  text?: string;
  payload?: string;
  fields?: Record<string, string>;
  options?: Record<string, unknown>;
  opts?: Record<string, unknown>;
}

export interface CleanRequest {
  text: string;
  options?: Record<string, unknown>;
  opts?: Record<string, unknown>;
}

export interface CheckRequest extends ScoreRequest {
  turnstileToken?: string;
  remember?: boolean;
  tenant?: string;
}

export interface EventCheckRequest {
  text?: string;
  payload?: string;
  fields?: Record<string, string>;
  /** Explicit idempotency key (webhook delivery id, form nonce, etc.) */
  eventId?: string;
  remember?: boolean;
  options?: Record<string, unknown>;
  opts?: Record<string, unknown>;
}

export interface EventCheckResult {
  duplicate: boolean;
  decision: SpamDecision;
  fingerprint: string;
  score: number;
  reasons: string[];
  normalized: string;
  mode: SpamMode;
  eventId: string | null;
}

export interface GeckodupeErrorBody {
  error?: string;
  hint?: string;
  reason?: string;
}

export class GeckodupeApiError extends Error {
  status: number;
  body: GeckodupeErrorBody;

  constructor(status: number, body: GeckodupeErrorBody) {
    const detail = [body.error, body.reason, body.hint].filter(Boolean).join(' — ');
    super(detail || 'Geckodupe API error (' + status + ')');
    this.name = 'GeckodupeApiError';
    this.status = status;
    this.body = body;
  }
}

export class GeckodupeTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeckodupeTimeoutError';
  }
}
