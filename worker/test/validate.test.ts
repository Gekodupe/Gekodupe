import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readJsonBody, sanitizeEventId, sanitizeBlocklist, hasSpamInput } from '../src/lib/validate.ts';

describe('validate', () => {
  it('rejects invalid event ids', () => {
    assert.equal(sanitizeEventId('ok-id_1').ok, true);
    assert.equal(sanitizeEventId('bad id!').ok, false);
    assert.equal(sanitizeEventId('x'.repeat(200)).ok, false);
  });

  it('caps blocklist', () => {
    const ok = sanitizeBlocklist(['a', 'b']);
    assert.equal(ok.ok, true);
    const big = sanitizeBlocklist(Array.from({ length: 501 }, (_, i) => 'p' + i));
    assert.equal(big.ok, false);
  });

  it('detects spam input presence', () => {
    assert.equal(hasSpamInput({ text: 'hi' }), true);
    assert.equal(hasSpamInput({ eventId: 'e1' }), true);
    assert.equal(hasSpamInput({}), false);
  });

  it('parses json body', async () => {
    const req = new Request('https://x.test', {
      method: 'POST',
      body: JSON.stringify({ text: 'hi' }),
      headers: { 'Content-Type': 'application/json' }
    });
    const r = await readJsonBody(req);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.body.text, 'hi');
  });
});
