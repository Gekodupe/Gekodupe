import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cleanText, scorePayload, spamFingerprint } from '../src/lib/spam-engine.ts';

/** Mirror of .development/geckodupe/tests/spam-parity-fixtures.js */
const CASES = [
  {
    id: 'honeypot-form',
    input: 'name=Ada\n_gotcha=bot\nemail=ada@example.com',
    opts: { mode: 'form' as const },
    expect: { decision: 'block', reasonsInclude: ['honeypot'] }
  },
  {
    id: 'clean-form',
    input: 'name=Ada\nemail=ada@example.com\nmessage=Hello there',
    opts: { mode: 'form' as const },
    expect: { decision: 'allow', reasonsExclude: ['honeypot'] }
  },
  {
    id: 'url-flood-clean',
    input: [
      'legit inquiry about pricing',
      'BUY NOW http://x.com http://y.com http://z.com http://w.com',
      'another real line'
    ].join('\n'),
    opts: { mode: 'list' as const, detectUrlFlood: true },
    expectClean: {
      minRemoved: 1,
      includes: ['legit inquiry', 'another real line'],
      excludes: ['BUY NOW']
    }
  },
  {
    id: 'fingerprint-honeypot-ignore',
    a: 'name=Ada\nemail=a@b.com',
    b: 'name=Ada\n_gotcha=x\nemail=a@b.com',
    opts: { mode: 'form' as const },
    expectFingerprintEqual: true
  }
];

describe('worker parity fixtures', () => {
  for (const c of CASES) {
    it(c.id, () => {
      if (c.expectFingerprintEqual) {
        assert.equal(spamFingerprint(c.a!, c.opts), spamFingerprint(c.b!, c.opts));
        return;
      }
      if (c.expectClean) {
        const cleaned = cleanText(c.input!, c.opts);
        assert.ok(cleaned.removedCount >= c.expectClean.minRemoved);
        for (const s of c.expectClean.includes) assert.ok(cleaned.cleaned.includes(s));
        for (const s of c.expectClean.excludes) assert.ok(!cleaned.cleaned.includes(s));
        return;
      }
      const r = scorePayload(c.input!, c.opts);
      if (c.expect?.decision) assert.equal(r.decision, c.expect.decision);
      for (const reason of c.expect?.reasonsInclude || []) assert.ok(r.reasons.includes(reason));
      for (const reason of c.expect?.reasonsExclude || []) assert.ok(!r.reasons.includes(reason));
    });
  }
});
