/**
 * Plain Node script — local normalize + hosted event check.
 *
 *   GECKODUPE_API_KEY=... node examples/node.mjs
 */
import { createClient, normalize, fingerprint, scorePayload } from 'geckodupe';

const payload = {
  email: 'user@example.com',
  message: 'Thanks for the demo'
};

console.log('normalized:', normalize(JSON.stringify(payload)));
console.log('fingerprint:', fingerprint(payload, { mode: 'form' }));
console.log('local score:', scorePayload(payload, { mode: 'form' }));

if (!process.env.GECKODUPE_API_KEY) {
  console.log('Set GECKODUPE_API_KEY to call the hosted API');
  process.exit(0);
}

const gecko = createClient({ apiKey: process.env.GECKODUPE_API_KEY });
const event = await gecko.checkEvent({
  fields: payload,
  eventId: 'demo-' + Date.now()
});
console.log('hosted checkEvent:', event);
