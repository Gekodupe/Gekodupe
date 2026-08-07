import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cleanText, scorePayload, spamFingerprint } from '../src/lib/spam-engine.ts';

describe('worker spam-engine', () => {
  it('blocks honeypot', () => {
    const r = scorePayload('name=Ada\n_gotcha=bot\nemail=ada@example.com', { mode: 'form' });
    assert.equal(r.decision, 'block');
    assert.ok(r.reasons.includes('honeypot'));
  });

  it('cleans url flood lines', () => {
    const input = [
      'legit inquiry about pricing',
      'BUY NOW http://x.com http://y.com http://z.com http://w.com',
      'another real line'
    ].join('\n');
    const cleaned = cleanText(input, { mode: 'list', detectUrlFlood: true });
    assert.ok(cleaned.removedCount >= 1);
    assert.ok(cleaned.cleaned.includes('legit inquiry'));
    assert.ok(!cleaned.cleaned.includes('BUY NOW'));
  });

  it('fingerprints ignore honeypot', () => {
    const a = spamFingerprint('name=Ada\nemail=a@b.com', { mode: 'form' });
    const b = spamFingerprint('name=Ada\n_gotcha=x\nemail=a@b.com', { mode: 'form' });
    assert.equal(a, b);
  });

  it('blocks bait and disposable mail', () => {
    const bait = scorePayload('Limited time offer act now for free money', { mode: 'list' });
    assert.ok(bait.reasons.includes('bait'));
    assert.equal(bait.decision, 'block');

    const disposable = scorePayload('hello@mailinator.com wants a deal', { mode: 'list' });
    assert.ok(disposable.reasons.includes('disposable_email'));
  });

  it('form clean strips blocklisted message fields', () => {
    const cleaned = cleanText(
      'name=Ada\nemail=ada@example.com\nmessage=See https://bit.ly/abc for crypto airdrop',
      { mode: 'form', blocklist: ['crypto airdrop'] }
    );
    assert.ok(cleaned.cleaned.includes('name=Ada'));
    assert.ok(!/crypto airdrop/i.test(cleaned.cleaned));
  });
});
