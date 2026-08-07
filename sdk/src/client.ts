import {
  DEFAULT_API_BASE,
  GeckodupeApiError,
  GeckodupeTimeoutError,
  type CheckRequest,
  type CleanRequest,
  type ClientOptions,
  type EventCheckRequest,
  type EventCheckResult,
  type ScoreRequest
} from './types.js';
import type { SpamCleanResult, SpamScoreResult } from './local/engine.js';

export interface GeckodupeClient {
  score(input: ScoreRequest | string | Record<string, string>): Promise<SpamScoreResult>;
  clean(input: CleanRequest | string): Promise<SpamCleanResult>;
  check(input: CheckRequest | string | Record<string, string>): Promise<{
    score: SpamScoreResult;
    cleaned: string;
    burst: boolean;
    turnstile?: { ok: boolean; reason?: string };
  }>;
  checkEvent(input: EventCheckRequest | string | Record<string, string>): Promise<EventCheckResult>;
  getBlocklist(): Promise<string[]>;
  putBlocklist(blocklist: string[]): Promise<{ ok: boolean; count: number }>;
}

function normalizeScoreBody(input: ScoreRequest | string | Record<string, string>): ScoreRequest {
  if (typeof input === 'string') return { text: input };
  if (
    input &&
    typeof input === 'object' &&
    !('text' in input) &&
    !('payload' in input) &&
    !('fields' in input) &&
    !('options' in input) &&
    !('opts' in input)
  ) {
    return { fields: input as Record<string, string> };
  }
  return input as ScoreRequest;
}

export function createClient(options: ClientOptions): GeckodupeClient {
  if (!options || !options.apiKey) {
    throw new Error('createClient requires apiKey');
  }

  const baseUrl = (options.baseUrl || DEFAULT_API_BASE).replace(/\/+$/, '');
  const doFetch = options.fetch || globalThis.fetch;
  const timeoutMs = options.timeoutMs == null ? 30000 : options.timeoutMs;
  if (typeof doFetch !== 'function') {
    throw new Error('fetch is not available; pass options.fetch');
  }

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const signals: AbortSignal[] = [];
    if (options.signal) signals.push(options.signal);
    if (controller) {
      signals.push(controller.signal);
      if (timeoutMs > 0) {
        timer = setTimeout(function () {
          controller.abort();
        }, timeoutMs);
      }
    }

    try {
      const res = await doFetch(baseUrl + path, {
        method,
        headers: {
          Authorization: 'Bearer ' + options.apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller ? controller.signal : options.signal
      });
      const text = await res.text();
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { error: text || 'Invalid JSON response' };
      }
      if (!res.ok) {
        throw new GeckodupeApiError(res.status, (data as object) || { error: res.statusText });
      }
      return data as T;
    } catch (err) {
      if (err instanceof GeckodupeApiError) throw err;
      const name = err && typeof err === 'object' && 'name' in err ? String((err as { name?: string }).name) : '';
      if (name === 'AbortError') {
        throw new GeckodupeTimeoutError(
          'Geckodupe request timed out after ' + timeoutMs + 'ms (' + method + ' ' + path + ')'
        );
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error('Geckodupe request failed (' + method + ' ' + baseUrl + path + '): ' + msg);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return {
    score(input) {
      const body = normalizeScoreBody(input);
      return request<SpamScoreResult>('POST', '/v1/spam/score', body);
    },
    clean(input) {
      const body = typeof input === 'string' ? { text: input } : input;
      return request<SpamCleanResult>('POST', '/v1/spam/clean', body);
    },
    check(input) {
      const body = normalizeScoreBody(input) as CheckRequest;
      return request('POST', '/v1/spam/check', body);
    },
    checkEvent(input) {
      const body =
        typeof input === 'string'
          ? { text: input }
          : input &&
              typeof input === 'object' &&
              !('text' in input) &&
              !('payload' in input) &&
              !('fields' in input) &&
              !('eventId' in input)
            ? { fields: input as Record<string, string> }
            : (input as EventCheckRequest);
      return request<EventCheckResult>('POST', '/v1/events/check', body);
    },
    async getBlocklist() {
      const r = await request<{ blocklist: string[] }>('GET', '/v1/spam/blocklist');
      return r.blocklist || [];
    },
    putBlocklist(blocklist) {
      return request('PUT', '/v1/spam/blocklist', { blocklist });
    }
  };
}
