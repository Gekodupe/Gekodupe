import { corsHeaders, jsonResponse } from './lib/cors';
import type { Env } from './lib/env';
import { handleSpamRoutes } from './routes/spam';
import { handleEventRoutes } from './routes/events';
import { handleAuthRoutes } from './routes/auth';
import { handleAccountRoutes } from './routes/account';
import { handleBillingRoutes } from './routes/billing';

export type { Env };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, '') || '/';

      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders(request) });
      }

      if (path === '/v1/health' || path === '/health') {
        return jsonResponse(
          {
            ok: true,
            service: 'geckodupe-api',
            version: '1.3.3',
            time: new Date().toISOString()
          },
          200,
          request
        );
      }

      const auth = await handleAuthRoutes(request, env, path);
      if (auth) return auth;

      const account = await handleAccountRoutes(request, env, path);
      if (account) return account;

      const billing = await handleBillingRoutes(request, env, path);
      if (billing) return billing;

      const spam = await handleSpamRoutes(request, env, path);
      if (spam) return spam;

      const events = await handleEventRoutes(request, env, path);
      if (events) return events;

      return jsonResponse(
        {
          error: 'Not found',
          hint: 'Try GET /v1/health, /v1/auth/*, /v1/account, /v1/billing/*, or POST /v1/spam/*|/v1/events/check'
        },
        404,
        request
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error';
      return jsonResponse({ error: message }, 500, request);
    }
  }
} satisfies ExportedHandler<Env>;
