const DEFAULT_ORIGINS = [
  'https://gekodupe.github.io',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
  'http://127.0.0.1:8787',
  'http://localhost:8787'
];

function isAllowedOrigin(origin: string, extraOrigins?: string[]): boolean {
  if (!origin) return false;
  const allow = new Set([...(extraOrigins || []), ...DEFAULT_ORIGINS]);
  if (allow.has(origin)) return true;
  if (/^https:\/\/([a-z0-9-]+\.)?gekodupe\.github\.io$/i.test(origin)) return true;
  return false;
}

export function corsHeaders(request: Request, extraOrigins?: string[]): HeadersInit {
  const origin = request.headers.get('Origin') || '';
  const allowed = isAllowedOrigin(origin, extraOrigins);

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
  if (allowed) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

export function jsonResponse(data: unknown, status = 200, request?: Request): Response {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  if (request) {
    const cors = corsHeaders(request);
    Object.entries(cors).forEach(([k, v]) => headers.set(k, v));
  }
  return new Response(JSON.stringify(data), { status, headers });
}
