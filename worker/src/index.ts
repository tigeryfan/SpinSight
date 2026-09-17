import type { Env } from './env';
import { runScrape } from './scrape';

/** Scheduled handler invoked by Cloudflare cron */
export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    // Let the Worker stay alive until scrape finishes
    ctx.waitUntil(runScrape(env));
  },
  // Placeholder fetch handler – not used in this task but required by Wrangler
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return new Response('Not implemented', { status: 501 });
  },
};