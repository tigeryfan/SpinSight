<script lang="ts">
  import { onMount } from 'svelte';
  import { reportMachineIds } from '../lib/data';
  import { loadTurnstile, turnstileSitekey, type TurnstileApi } from '../lib/turnstile';

  let { dorm, theme }: { dorm: string; theme: 'light' | 'dark' } = $props();
  let machineIds = $state('');
  let token = $state('');
  let sending = $state(false);
  let message = $state('');
  let sent = $state(false);
  let container: HTMLDivElement;
  let api: TurnstileApi | null = null;
  let widgetId: string | null = null;
  let renderedTheme: 'light' | 'dark' | null = null;

  function renderWidget() {
    if (!api) return;
    if (widgetId) api.remove(widgetId);
    token = '';
    widgetId = api.render(container, {
      sitekey: turnstileSitekey,
      action: 'machine_report',
      appearance: 'always',
      theme,
      callback: value => { token = value; message = ''; },
      'error-callback': () => { token = ''; message = 'Verification could not load. Please try again.'; },
      'expired-callback': () => { token = ''; if (widgetId) api?.reset(widgetId); },
    });
    renderedTheme = theme;
  }

  onMount(() => {
    let disposed = false;
    void loadTurnstile().then(turnstile => {
      if (disposed) return;
      api = turnstile;
      renderWidget();
    }).catch(() => { if (!disposed) message = 'Verification could not load. Please reload the page and try again.'; });
    return () => { disposed = true; if (api && widgetId) api.remove(widgetId); };
  });

  $effect(() => {
    const nextTheme = theme;
    if (widgetId && renderedTheme !== nextTheme) renderWidget();
  });

  async function send(event: SubmitEvent) {
    event.preventDefault();
    if (sending || !token || !machineIds.trim()) return;
    sending = true;
    message = '';
    sent = false;
    try {
      await reportMachineIds(dorm, machineIds.trim(), token);
      sent = true;
      machineIds = '';
      message = 'Thanks. Your machine IDs were sent.';
    } catch {
      message = 'Could not send the machine IDs. Please try again.';
    } finally {
      token = '';
      if (widgetId) api?.reset(widgetId);
      sending = false;
    }
  }
</script>

<form class="report-form" onsubmit={send}>
  <label for="machine-ids">Machine IDs</label>
  <textarea id="machine-ids" bind:value={machineIds} maxlength="500" rows="3" placeholder="For example: W5, D6" required></textarea>
  <div class="verification" bind:this={container}></div>
  <button class="pill send-button" type="submit" disabled={!token || !machineIds.trim() || sending}>{sending ? 'Sending…' : 'Send machine IDs'}</button>
  {#if message}<p class:success={sent} class="report-message" role="status">{message}</p>{/if}
</form>

<style>
  .report-form { display: grid; justify-items: start; gap: 12px; max-width: 480px; margin-top: 20px; }
  label { font-size: 13px; font-weight: 600; }
  textarea { width: 100%; min-height: 84px; padding: 12px; resize: vertical; border: 1px solid var(--line); border-radius: var(--radius-control); background: var(--bg); color: var(--ink); font: inherit; }
  .verification { width: fit-content; max-width: 100%; height: 65px; }
  .send-button { background: var(--selected); color: var(--selected-ink); }
  .report-message { margin: 0; color: var(--warn); font-size: 13px; }
  .report-message.success { color: var(--ink); }
</style>
