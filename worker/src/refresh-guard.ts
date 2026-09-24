export function challengeRequired(attemptsInMinute: number): boolean {
  return attemptsInMinute > 3;
}

export async function verifyTurnstile(
  token: string,
  action: 'refresh_background' | 'refresh_challenge',
  secret: string,
  hostnames: string | string[],
  clientIp: string,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const allowedHostnames = Array.isArray(hostnames) ? hostnames : [hostnames];
  if (!token || token.length > 2048 || !secret || allowedHostnames.length === 0 || allowedHostnames.some(hostname => !hostname)) return false;
  try {
    const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: clientIp }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return false;
    const result = await response.json() as { success?: boolean; action?: string; hostname?: string };
    return result.success === true && result.action === action && typeof result.hostname === 'string' && allowedHostnames.includes(result.hostname);
  } catch {
    return false;
  }
}

export async function recordRefreshAttempt(db: D1Database, clientKey: string): Promise<number> {
  const now = Date.now();
  const [, count] = await db.batch([
    db.prepare('INSERT INTO refresh_attempts (client_key, attempted_at) VALUES (?, ?)').bind(clientKey, now),
    db.prepare('SELECT COUNT(*) AS count FROM refresh_attempts WHERE client_key = ? AND attempted_at > ?').bind(clientKey, now - 60_000),
  ]);
  return Number((count.results[0] as { count?: number } | undefined)?.count ?? 0);
}
