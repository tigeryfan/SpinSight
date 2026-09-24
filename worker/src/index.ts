import type { Env } from './env';
import { RefreshError, runScrape } from './scrape';
import { readDashboard } from './store';
import { challengeRequired, recordRefreshAttempt, verifyTurnstile } from './refresh-guard';
import { clientIdentity } from './client-identity';

function corsHeaders(request: Request, hostnames: string): Headers {
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
  });
  const origin = request.headers.get('Origin');
  if (origin) {
    try {
      const url = new URL(origin);
      if (hostnames.split(',').some(hostname => hostname.trim() === url.hostname)
        && (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) {
        headers.set('Access-Control-Allow-Origin', origin);
        headers.set('Access-Control-Allow-Credentials', 'true');
      }
    } catch { /* Ignore invalid origins. */ }
  }
  return headers;
}

function jsonError(status: number, code: string, message: string, headers: Headers): Response {
  return Response.json({ error: { code, message } }, { status, headers });
}

function parseTimestamp(value: string | null): number {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return NaN;
  }
  const calendarDate = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== value.slice(0, 10)) {
    return NaN;
  }
  return Date.parse(value);
}

/** Scheduled handler invoked by Cloudflare cron */
export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    // Let the Worker stay alive until scrape finishes
    ctx.waitUntil(runScrape(env));
    ctx.waitUntil(env.DB.prepare('DELETE FROM refresh_attempts WHERE attempted_at < ?').bind(Date.now() - 60_000).run());
  },
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const headers = corsHeaders(request, env.TURNSTILE_HOSTNAMES ?? '');
    if (url.pathname !== '/v1/scrape' && url.pathname !== '/v1/dashboard') {
      return jsonError(404, 'not_found', 'Not found.', headers);
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== (url.pathname === '/v1/scrape' ? 'POST' : 'GET')) {
      return jsonError(405, 'method_not_allowed', url.pathname === '/v1/scrape' ? 'Use POST for this endpoint.' : 'Use GET for this endpoint.', headers);
    }

    try {
      const identity = env.TURNSTILE_SECRET
        ? await clientIdentity(request, env.TURNSTILE_SECRET)
        : null;
      if (identity?.setCookie) headers.set('Set-Cookie', identity.setCookie);
      if (url.pathname === '/v1/scrape') {
        if (!env.TURNSTILE_SECRET || !env.TURNSTILE_HOSTNAMES) {
          return jsonError(503, 'verification_unavailable', 'Refresh verification is unavailable.', headers);
        }
        let body: { token?: unknown; mode?: unknown };
        try { body = await request.json() as typeof body; }
        catch { return jsonError(400, 'invalid_request', 'Provide a verification token.', headers); }
        const token = body?.token;
        const mode = body?.mode;
        if (typeof token !== 'string' || (mode !== 'background' && mode !== 'challenge')) {
          return jsonError(400, 'invalid_request', 'Provide a verification token.', headers);
        }
        const clientIp = request.headers.get('CF-Connecting-IP') ?? '';
        const hostnames = env.TURNSTILE_HOSTNAMES.split(',').map(hostname => hostname.trim()).filter(Boolean);
        if (mode === 'background') {
          const attempts = await recordRefreshAttempt(env.DB, identity!.key);
          if (challengeRequired(attempts)) return jsonError(403, 'challenge_required', 'Complete a verification to refresh.', headers);
        }
        const action = mode === 'background' ? 'refresh_background' : 'refresh_challenge';
        const verified = await verifyTurnstile(token, action, env.TURNSTILE_SECRET, hostnames, clientIp);
        if (!verified) return jsonError(403, mode === 'background' ? 'challenge_required' : 'verification_failed', 'Complete a verification to refresh.', headers);
        const result = await runScrape(env);
        return Response.json({ ok: true, ...result }, { headers });
      }

      const start = parseTimestamp(url.searchParams.get('start'));
      const end = parseTimestamp(url.searchParams.get('end'));
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 8 * 24 * 60 * 60 * 1000) {
        return jsonError(400, 'invalid_range', 'Provide ISO start and end timestamps with a timezone, in order and at most 8 days apart.', headers);
      }
      const dashboard = await readDashboard(env, new Date(start).toISOString(), new Date(end).toISOString());
      return Response.json(dashboard, { headers });
    } catch (error) {
      console.error(JSON.stringify({
        event: 'request_failed', path: url.pathname,
        message: error instanceof Error ? error.message : 'Unknown error',
      }));
      if (error instanceof RefreshError) {
        return jsonError(502, 'refresh_failed', 'Unable to refresh machine data.', headers);
      }
      return jsonError(500, 'database_error', url.pathname === '/v1/scrape'
        ? 'Unable to save refreshed machine data.'
        : 'Unable to load machine data.', headers);
    }
  },
} satisfies ExportedHandler<Env>;
