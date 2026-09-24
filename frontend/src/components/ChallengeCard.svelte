<script lang="ts">
  import { onMount } from 'svelte';
  import { loadTurnstile, type TurnstileApi } from '../lib/turnstile';

  let { solved, failed }: { solved: (token: string) => Promise<boolean>; failed: () => void } = $props();
  let container: HTMLDivElement;
  let message = $state('');
  let api: TurnstileApi | null = null;
  let widgetId: string | null = null;
  let disposed = false;

  async function renderWidget() {
    const sitekey = import.meta.env.VITE_TURNSTILE_CHALLENGE_SITE_KEY;
    if (!sitekey) { message = 'Verification is not configured.'; failed(); return; }
    message = '';
    try {
      api = await loadTurnstile();
      if (disposed) return;
      if (widgetId) api.remove(widgetId);
      widgetId = api.render(container, {
        sitekey,
        action: 'refresh_challenge',
        callback: token => { void solved(token).then(ok => {
          if (!ok && widgetId) { message = 'Verification did not complete. Please try again.'; api?.reset(widgetId); }
        }); },
        'error-callback': () => { message = 'Verification failed to load. Please try again.'; failed(); },
        'expired-callback': () => { if (widgetId) api?.reset(widgetId); },
      });
    } catch { if (!disposed) { message = 'Verification failed to load. Please try again.'; failed(); } }
  }

  onMount(() => {
    document.getElementById('challenge-title')?.focus();
    void renderWidget();
    return () => { disposed = true; if (api && widgetId) api.remove(widgetId); };
  });
</script>

<section class="challenge-card" aria-labelledby="challenge-title">
  <div class="challenge-copy"><h2 id="challenge-title" tabindex="-1">Verify to refresh</h2><p>Complete this check to get the latest machine status.</p></div>
  <div class="challenge-widget" bind:this={container}></div>
  {#if message}<div class="challenge-error" role="alert"><span>{message}</span>{#if import.meta.env.VITE_TURNSTILE_CHALLENGE_SITE_KEY}<button onclick={() => void renderWidget()}>Try again</button>{/if}</div>{/if}
</section>

<style>
  .challenge-card { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; padding: 16px 20px; margin-bottom: 16px; border: 1px solid var(--accent); border-radius: var(--radius-panel); background: var(--panel); box-shadow: var(--popover-shadow); }
  .challenge-copy p { margin: 4px 0 0; color: var(--muted); }
  .challenge-widget { min-height: 65px; }
  .challenge-error { display: flex; align-items: center; gap: 12px; width: 100%; color: var(--warn); }
  .challenge-error button { border: 0; background: transparent; color: var(--ink); text-decoration: underline; }
  .challenge-copy h2:focus { outline: none; }
  @media (max-width: 600px) { .challenge-card { align-items: stretch; flex-direction: column; padding: 14px; } }
</style>
