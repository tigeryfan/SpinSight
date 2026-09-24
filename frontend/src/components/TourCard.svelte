<script lang="ts">
  let { step, next, back, close }: {
    step: number;
    next: () => void;
    back: () => void;
    close: () => void;
  } = $props();

  const steps = [
    { title: 'Refresh data', text: 'Press the refresh button to fetch the latest machine readings.' },
    { title: 'Change theme', text: 'Press the theme button to switch between light, dark, and your device setting.' },
    { title: 'Choose a dorm', text: 'Open the dorm menu to see machines in one dorm, or choose All Dorms.' },
    { title: 'Change the view', text: 'Choose Week or a day above the usage chart to see a different time period.' },
  ];
</script>

<section class="tour-card" aria-labelledby="tour-title" aria-live="polite">
  <div class="tour-copy">
    <p class="tour-progress">Tour · {step + 1} of {steps.length}</p>
    <h2 id="tour-title" tabindex="-1">{steps[step].title}</h2>
    <p>{steps[step].text}</p>
  </div>
  <div class="tour-actions">
    {#if step > 0}<button class="tour-secondary" onclick={back}>Back</button>{/if}
    <button class="tour-secondary" onclick={close}>Skip tour</button>
    <button class="tour-primary" onclick={next}>{step === steps.length - 1 ? 'Finish' : 'Next'}</button>
  </div>
</section>

<style>
  .tour-card { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 16px 20px; margin-bottom: 16px; border: 1px solid var(--accent); border-radius: var(--radius-panel); background: var(--panel); box-shadow: var(--popover-shadow); }
  .tour-copy p { margin: 4px 0 0; color: var(--muted); }
  .tour-copy .tour-progress { margin: 0 0 4px; color: var(--accent); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
  .tour-actions { display: flex; align-items: center; gap: 8px; flex: none; }
  button { min-height: 36px; padding: 8px 12px; border: 0; border-radius: var(--radius-control); font-size: 12px; }
  .tour-secondary { background: transparent; color: var(--muted); }
  .tour-secondary:hover { color: var(--ink); }
  .tour-primary { background: var(--selected); color: var(--selected-ink); }
  @media (max-width: 600px) { .tour-card { align-items: stretch; flex-direction: column; gap: 12px; padding: 14px; } .tour-actions { justify-content: flex-end; flex-wrap: wrap; } }
</style>
