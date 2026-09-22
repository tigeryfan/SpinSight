import type { Env } from './env';
import { RefreshError, runScrape } from './scrape';
import { readDashboard } from './store';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

function jsonError(status: number, code: string, message: string): Response {
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
  },
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/v1/scrape' && url.pathname !== '/v1/dashboard') {
      return jsonError(404, 'not_found', 'Not found.');
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== 'GET') {
      return jsonError(405, 'method_not_allowed', 'Use GET for this endpoint.');
    }

    try {
      if (url.pathname === '/v1/scrape') {
        const result = await runScrape(env);
        return Response.json({ ok: true, ...result }, { headers });
      }

      const start = parseTimestamp(url.searchParams.get('start'));
      const end = parseTimestamp(url.searchParams.get('end'));
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 8 * 24 * 60 * 60 * 1000) {
        return jsonError(400, 'invalid_range', 'Provide ISO start and end timestamps with a timezone, in order and at most 8 days apart.');
      }
      const dashboard = await readDashboard(env, new Date(start).toISOString(), new Date(end).toISOString());
      return Response.json(dashboard, { headers });
    } catch (error) {
      console.error(JSON.stringify({
        event: 'request_failed', path: url.pathname,
        message: error instanceof Error ? error.message : 'Unknown error',
      }));
      if (error instanceof RefreshError) {
        return jsonError(502, 'refresh_failed', 'Unable to refresh machine data.');
      }
      return jsonError(500, 'database_error', url.pathname === '/v1/scrape'
        ? 'Unable to save refreshed machine data.'
        : 'Unable to load machine data.');
    }
  },
} satisfies ExportedHandler<Env>;
