import type { Env } from './env';
import { runScrape } from './scrape';

/** Scheduled handler invoked by Cloudflare cron */
export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    // Let the Worker stay alive until scrape finishes
    ctx.waitUntil(runScrape(env));
  },
  // Manual trigger: GET /api/scrape runs the scrape and writes to D1
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/scrape') {
      return new Response('Not found', { status: 404 });
    }
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }
    await runScrape(env);
    return Response.json({ ok: true });
  },
};