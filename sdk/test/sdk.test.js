import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalize,
  fingerprint,
  scorePayload,
  cleanText,
  createClient,
  GeckodupeApiError
} from '../dist/index.js';

describe('geckodupe local engine', () => {
  it('normalizes tracker noise', () => {
    const a = normalize('Hello 2024-01-01T12:00:00Z world');
    const b = normalize('Hello world');
    assert.equal(a.includes('2024'), false);
    assert.ok(a.includes('hello'));
    assert.ok(b.includes('hello'));
  });

  it('fingerprints ignore honeypot fields', () => {
    const a = fingerprint('name=Ada\nemail=a@b.com', { mode: 'form' });
    const b = fingerprint('name=Ada\n_gotcha=x\nemail=a@b.com', { mode: 'form' });
    assert.equal(a, b);
  });

  it('scores honeypot as block', () => {
    const r = scorePayload('name=Ada\n_gotcha=bot\nemail=ada@example.com', { mode: 'form' });
    assert.equal(r.decision, 'block');
    assert.ok(r.reasons.includes('honeypot'));
  });

  it('cleans url flood lines', () => {
    const cleaned = cleanText(
      ['legit', 'BUY NOW http://x.com http://y.com http://z.com http://w.com', 'ok'].join('\n'),
      { mode: 'list' }
    );
    assert.ok(cleaned.cleaned.includes('legit'));
    assert.ok(!cleaned.cleaned.includes('BUY NOW'));
  });
});

describe('geckodupe client', () => {
  it('requires apiKey', () => {
    assert.throws(() => createClient({ apiKey: '' }));
  });

  it('sends bearer auth and parses score', async () => {
    const calls = [];
    const client = createClient({
      apiKey: 'test-key',
      baseUrl: 'https://api.test',
      fetch: async (url, init) => {
        calls.push({ url: String(url), init });
        return new Response(
          JSON.stringify({
            score: 0.1,
            reasons: [],
            decision: 'allow',
            fingerprint: 'abc',
            normalized: 'hi',
            mode: 'list'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    });
    const r = await client.score('hi');
    assert.equal(r.decision, 'allow');
    assert.equal(calls[0].url, 'https://api.test/v1/spam/score');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer test-key');
  });

  it('throws GeckodupeApiError on 401', async () => {
    const client = createClient({
      apiKey: 'bad',
      baseUrl: 'https://api.test',
      fetch: async () =>
        new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
    });
    await assert.rejects(() => client.score('x'), (err) => {
      assert.ok(err instanceof GeckodupeApiError);
      assert.equal(err.status, 401);
      return true;
    });
  });

  it('checkEvent posts to /v1/events/check', async () => {
    let path = '';
    const client = createClient({
      apiKey: 'k',
      baseUrl: 'https://api.test',
      fetch: async (url) => {
        path = String(url);
        return new Response(
          JSON.stringify({
            duplicate: false,
            decision: 'allow',
            fingerprint: 'f',
            score: 0,
            reasons: [],
            normalized: '',
            mode: 'form',
            eventId: 'e1'
          }),
          { status: 200 }
        );
      }
    });
    const r = await client.checkEvent({ text: 'ok', eventId: 'e1' });
    assert.equal(path, 'https://api.test/v1/events/check');
    assert.equal(r.duplicate, false);
  });
});
