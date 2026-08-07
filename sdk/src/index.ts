export { createClient, type GeckodupeClient } from './client.js';
export {
  DEFAULT_API_BASE,
  GeckodupeApiError,
  GeckodupeTimeoutError,
  type ClientOptions,
  type ScoreRequest,
  type CleanRequest,
  type CheckRequest,
  type EventCheckRequest,
  type EventCheckResult,
  type SpamDecision,
  type SpamMode
} from './types.js';

export {
  spamNormalizeText as normalize,
  spamFingerprint as fingerprint,
  scorePayload,
  cleanText,
  spamDefaultOpts,
  spamParseFormFields,
  calculateSimilarity,
  type SpamOpts,
  type SpamScoreResult,
  type SpamCleanResult
} from './local/engine.js';

export { idempotencyGuard, type IdempotencyGuardOptions } from './middleware/guard.js';
export { createExpressMiddleware, type ExpressMiddlewareOptions } from './middleware/express.js';
export { createFastifyPlugin, type FastifyPluginOptions } from './middleware/fastify.js';
export { createHonoMiddleware, type HonoMiddlewareOptions } from './middleware/hono.js';
