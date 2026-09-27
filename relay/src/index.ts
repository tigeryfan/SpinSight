interface Env {
  TURNSTILE_SECRET?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

const allowedDorms = new Set(['Appleby', 'Jameson', 'Jones']);
const reportDorms = new Set(['All Dorms', 'Alamo', 'Appleby', 'Jameson', 'Jones', 'North Hutch', 'South Hutch', 'Upper Dorms']);
const allowedOrigin = 'https://spinsight.xyz';

function response(body: object, status: number, headers: Headers): Response {
  return Response.json(body, { status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const url = new URL(request.url);
    const fetchSite = request.headers.get('Sec-Fetch-Site');
    const contentType = request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
    // Permit missing browser metadata only for JSON POSTs to our production host.
    // Cross-origin JSON requires a preflight, which still requires an allowed Origin.
    const reportWithoutOrigin = (origin === null || origin === 'null')
      && (fetchSite === null || fetchSite === 'same-origin')
      && url.origin === allowedOrigin
      && request.method === 'POST'
      && contentType === 'application/json';
    const headers = new Headers({
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin, Sec-Fetch-Site',
    });
    if (origin !== allowedOrigin && !reportWithoutOrigin) {
      let error = 'Forbidden origin.';
      if (url.searchParams.has('debug')) {
        const display = (value: string | null) => value === null ? '(absent)' : JSON.stringify(value);
        const failedFallbackChecks = [
          origin !== null && origin !== 'null' ? 'Origin must be absent or the literal "null"' : '',
          fetchSite !== null && fetchSite !== 'same-origin' ? 'Sec-Fetch-Site must be absent or "same-origin"' : '',
          url.origin !== allowedOrigin ? `Destination origin must be ${allowedOrigin}` : '',
          request.method !== 'POST' ? 'Method must be POST' : '',
          contentType !== 'application/json' ? 'Content-Type must be application/json' : '',
        ].filter(Boolean);
        error += '\n' + [
          'Relay origin diagnostics:',
          `Expected Origin: ${allowedOrigin}`,
          `Received Origin: ${display(origin)}`,
          `Received Sec-Fetch-Site: ${display(fetchSite)}`,
          `Received Content-Type: ${display(request.headers.get('Content-Type'))}`,
          `Received method: ${request.method}`,
          `Relay destination: ${url.origin}${url.pathname}`,
          'Origin did not match the allowed origin.',
          ...failedFallbackChecks.map(check => `Fallback failed: ${check}`),
        ].join('\n');
      }
      return response({ error }, 403, headers);
    }
    if (origin === allowedOrigin) headers.set('Access-Control-Allow-Origin', allowedOrigin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return response({ error: 'Use POST.' }, 405, headers);
    const path = url.pathname;
    const problem = path === '/v1/problem-report';
    if (!problem && path !== '/v1/machine-report') return response({ error: 'Not found.' }, 404, headers);
    if (!env.TURNSTILE_SECRET || !env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
      return response({ error: 'Report service is unavailable.' }, 503, headers);
    }

    let body: Record<string, unknown>;
    try {
      const raw = await request.text();
      if (raw.length > 16384) return response({ error: 'Report is too long.' }, 413, headers);
      body = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return response({ error: 'Invalid report.' }, 400, headers);
    }
    const dorm = body?.dorm;
    const value = problem ? body?.description : body?.machineIds;
    const content = typeof value === 'string' ? value.trim() : '';
    const token = body?.token;
    if (typeof dorm !== 'string' || !(problem ? reportDorms : allowedDorms).has(dorm) || !content || content.length > (problem ? 1500 : 500)
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
      if (!check.ok || result.success !== true || result.action !== (problem ? 'problem_report' : 'machine_report') || result.hostname !== 'spinsight.xyz') {
        return response({ error: 'Verification failed. Please try again.' }, 403, headers);
      }
      const diagnostics = body.diagnostics && typeof body.diagnostics === 'object' && !Array.isArray(body.diagnostics)
        ? body.diagnostics as Record<string, unknown> : {};
      const field = (value: unknown, limit: number) => typeof value === 'string' && value.trim()
        ? value.replace(/[\r\n\t]/g, ' ').slice(0, limit) : 'Not provided';
      const details = [
        `Page: ${field(diagnostics.page, 700)}`,
        `UA: ${field(diagnostics.userAgent ?? request.headers.get('User-Agent'), 400)}`,
        `Language: ${field(diagnostics.language, 40)}`,
        `Viewport: ${field(diagnostics.viewport, 40)}`,
        `Received: ${new Date().toISOString()}`,
        `Turnstile: verified`,
        `Turnstile action: ${result.action}`,
        `Turnstile hostname: ${result.hostname}`,
      ].join('\n');
      const sent = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: `SpinSight ${problem ? 'problem report' : 'machine IDs'} for ${dorm}\n\n${content}\n\nDiagnostics\n${details}` }),
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
