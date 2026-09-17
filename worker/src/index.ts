import type { Env } from './env';
import { runScrape } from './scrape';

/** Scheduled handler invoked by Cloudflare cron */
export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    // Let the Worker stay alive until scrape finishes
    ctx.waitUntil(runScrape(env));
  },
  // Manual trigger: GETs scrape Greenwald and write to D1
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }
    await runScrape(env);
    return Response.json({ ok: true });
  },
};