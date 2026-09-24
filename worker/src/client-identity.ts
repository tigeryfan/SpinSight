const cookieName = 'spinsight-client';

async function signingKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function clientIdentity(request: Request, secret: string): Promise<{ key: string; setCookie: string | null }> {
  const raw = request.headers.get('Cookie')?.split(';').map(cookie => cookie.trim())
    .find(cookie => cookie.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  const [id, signature] = raw?.split('.') ?? [];
  const key = await signingKey(secret);
  if (id && signature && /^[0-9a-f-]{36}$/.test(id) && /^[0-9a-f]{64}$/.test(signature)) {
    const bytes = Uint8Array.from(signature.match(/../g)!, pair => parseInt(pair, 16));
    if (await crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(id))) {
      return { key: id, setCookie: null };
    }
  }
  const freshId = crypto.randomUUID();
  const signed = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(freshId)));
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return {
    key: freshId,
    setCookie: `${cookieName}=${freshId}.${signed}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`,
  };
}
