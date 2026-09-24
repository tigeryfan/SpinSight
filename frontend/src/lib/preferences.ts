export function cookieValue(cookies: string, name: string): string | null {
  const entry = cookies.split(';').map(cookie => cookie.trim()).find(cookie => cookie.startsWith(`${name}=`));
  if (!entry) return null;
  try { return decodeURIComponent(entry.slice(name.length + 1)); }
  catch { return null; }
}

export function preferenceCookie(name: string, value: string): string {
  return `${name}=${encodeURIComponent(value)}; Max-Age=31536000; Path=/; SameSite=Lax`;
}

export function selectDorm(dorms: string[], requested: string | null, saved: string | null): string {
  const options = ['All Dorms', ...dorms];
  for (const choice of [requested, saved]) {
    const match = options.find(option => option.toLowerCase() === choice?.trim().toLowerCase());
    if (match) return match;
  }
  return 'All Dorms';
}
