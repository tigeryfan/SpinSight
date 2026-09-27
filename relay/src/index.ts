interface Env {
  TURNSTILE_SECRET?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

const allowedDorms = new Set(['Alamo', 'Appleby', 'Jameson', 'Jones']);
const allowedOrigin = 'https://spinsight.xyz';

function response(body: object, status: number, headers: Headers): Response {
  return Response.json(body, { status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const headers = new Headers({
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    });
    if (origin !== allowedOrigin) return response({ error: 'Forbidden origin.' }, 403, headers);
    headers.set('Access-Control-Allow-Origin', allowedOrigin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return response({ error: 'Use POST.' }, 405, headers);
    if (new URL(request.url).pathname !== '/v1/machine-report') return response({ error: 'Not found.' }, 404, headers);
    if (!env.TURNSTILE_SECRET || !env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
      return response({ error: 'Report service is unavailable.' }, 503, headers);
    }

    let body: Record<string, unknown>;
    try {
      const raw = await request.text();
      if (raw.length > 4096) return response({ error: 'Report is too long.' }, 413, headers);
      body = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return response({ error: 'Invalid report.' }, 400, headers);
    }
    const dorm = body?.dorm;
    const machineIds = typeof body?.machineIds === 'string' ? body.machineIds.trim() : '';
    const token = body?.token;
    if (typeof dorm !== 'string' || !allowedDorms.has(dorm) || !machineIds || machineIds.length > 500
      || typeof token !== 'string' || !token || token.length > 2048) {
      return response({ error: 'Invalid report.' }, 400, headers);
    }

    try {
      const check = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: request.headers.get('CF-Connecting-IP') ?? '' }),
        signal: AbortSignal.timeout(10_000),
      });
      const result = await check.json() as { success?: boolean; action?: string; hostname?: string };
      if (!check.ok || result.success !== true || result.action !== 'machine_report' || result.hostname !== 'spinsight.xyz') {
        return response({ error: 'Verification failed. Please try again.' }, 403, headers);
      }
      const sent = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: `SpinSight machine IDs for ${dorm}\n\n${machineIds}` }),
        signal: AbortSignal.timeout(10_000),
      });
      const telegram = await sent.json() as { ok?: boolean };
      if (!sent.ok || telegram.ok !== true) return response({ error: 'Could not send the report.' }, 502, headers);
      return response({ ok: true }, 200, headers);
    } catch {
      return response({ error: 'Could not send the report.' }, 502, headers);
    }
  },
} satisfies ExportedHandler<Env>;
