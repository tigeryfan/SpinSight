export interface TurnstileApi {
  render: (container: HTMLElement, options: {
    sitekey: string;
    action: string;
    callback: (token: string) => void;
    'error-callback': () => void;
    'expired-callback'?: () => void;
    appearance?: 'always' | 'interaction-only';
  }) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

let loading: Promise<TurnstileApi> | null = null;

export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;
  const pending = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    const timer = window.setTimeout(() => { script.remove(); reject(new Error('Turnstile timed out.')); }, 10_000);
    script.onload = () => { window.clearTimeout(timer); window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile did not load.')); };
    script.onerror = () => { window.clearTimeout(timer); reject(new Error('Turnstile did not load.')); };
    document.head.appendChild(script);
  });
  loading = pending.catch(error => { loading = null; throw error; });
  return loading;
}
