<script lang="ts">
  import { onMount } from 'svelte';
  import { sendReport } from '../lib/data';
  import { loadTurnstile, turnstileSitekey, type TurnstileApi } from '../lib/turnstile';

  let { dorm, theme, problem = false, debug = false }: { dorm: string; problem?: boolean; debug?: boolean; theme: 'light' | 'dark' } = $props();
  let content = $state('');
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
      action: problem ? 'problem_report' : 'machine_report',
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
    }).catch(cause => {
      if (!disposed) message = debug ? String(cause instanceof Error ? cause.message : cause) : 'Verification could not load. Please reload the page and try again.';
    });
    return () => { disposed = true; if (api && widgetId) api.remove(widgetId); };
  });

  $effect(() => {
    const nextTheme = theme;
    if (widgetId && renderedTheme !== nextTheme) renderWidget();
  });

  async function send(event: SubmitEvent) {
    event.preventDefault();
    if (sending || !token || !content.trim()) return;
    sending = true;
    message = '';
    sent = false;
    try {
      await sendReport(dorm, content.trim(), token, problem);
      sent = true;
      content = '';
      message = 'Your report was submitted.';
    } catch (cause) {
      message = debug ? String(cause instanceof Error ? cause.message : cause) : 'Could not send the report. Please try again.';
    } finally {
      token = '';
      if (widgetId) api?.reset(widgetId);
      sending = false;
    }
  }
</script>

<form class="report-form" onsubmit={send}>
  <label for={problem ? 'problem-description' : 'machine-ids'}>{problem ? 'Describe the problem' : 'Machine IDs'}</label>
  <textarea id={problem ? 'problem-description' : 'machine-ids'} bind:value={content} maxlength={problem ? 1500 : 500} rows="3" placeholder={problem ? 'What went wrong? Include the dorm and machine ID if relevant.' : 'For example: W5, D6'} required></textarea>
  <div class="turnstile-frame"><div class="turnstile-content" bind:this={container}></div></div>
  <p class="report-context">Sending a report includes relevant troubleshooting details.</p>
  <button class="pill send-button" type="submit" disabled={!token || !content.trim() || sending}>{sending ? 'Sending…' : problem ? 'Send report' : 'Send machine IDs'}</button>
  {#if message}<p class:success={sent} class="report-message" role="status">{message}</p>{/if}
</form>

<style>
  .report-form { display: grid; justify-items: start; gap: 12px; max-width: 480px; margin-top: 20px; }
  label { font-size: 13px; font-weight: 600; }
  textarea { width: 100%; min-height: 84px; padding: 12px; resize: vertical; border: none; border-radius: var(--radius-control); background: var(--bg); color: var(--ink); font: inherit; }
  .send-button { background: var(--selected); color: var(--selected-ink); }
  .report-message { margin: 0; color: var(--warn); font-size: 13px; overflow-wrap: anywhere; white-space: pre-wrap; }
  .report-message.success { color: var(--ink); }
  .report-context { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
</style>
