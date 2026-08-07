import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseApiKeys, requireApiKey, tenantIdFromKey, extractBearerToken } from '../src/lib/auth.ts';

describe('auth', () => {
  it('parses comma-separated and JSON API keys', () => {
    assert.equal(parseApiKeys('a,b c').has('a'), true);
    assert.equal(parseApiKeys('a,b c').has('b'), true);
    assert.equal(parseApiKeys('{"prod":"k1"}').has('k1'), true);
  });

  it('rejects open access when no keys configured', async () => {
    const req = new Request('https://api.example/v1/spam/score');
    const env = { GECKODUPE_SPAM: { get: async () => null } };
    const r = await requireApiKey(req, env);
    assert.equal(r.ok, false);
  });

  it('allows open access only when ALLOW_OPEN_API is set', async () => {
    const req = new Request('https://api.example/v1/spam/score');
    const env = { GECKODUPE_SPAM: { get: async () => null }, ALLOW_OPEN_API: '1' };
    const r = await requireApiKey(req, env);
    assert.equal(r.ok, true);
    if (r.ok) assert.ok(r.tenant.startsWith('t'));
  });

  it('rejects missing bearer when keys are set', async () => {
    const req = new Request('https://api.example/v1/spam/score');
    const env = {
      API_KEYS: 'secret-key',
      GECKODUPE_SPAM: { get: async () => null }
    };
    const r = await requireApiKey(req, env);
    assert.equal(r.ok, false);
  });

  it('accepts valid bearer and stable tenant', async () => {
    const req = new Request('https://api.example/v1/spam/score', {
      headers: { Authorization: 'Bearer secret-key' }
    });
    const env = {
      API_KEYS: 'secret-key',
      GECKODUPE_SPAM: { get: async () => null }
    };
    const r = await requireApiKey(req, env);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.tenant, tenantIdFromKey('secret-key'));
      assert.equal(extractBearerToken(req), 'secret-key');
    }
  });
});
