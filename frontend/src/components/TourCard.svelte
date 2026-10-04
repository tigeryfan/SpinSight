<script lang="ts">
  import { cardTransition } from '../lib/transitions';
  let { step, next, back, close, whyNoLaundryText }: {
    step: number;
    next: () => void;
    back: () => void;
    close: () => void;
    whyNoLaundryText: string;
  } = $props();

  const steps = [
    { title: 'Get fresh machine status', text: 'Use this button to fetch the latest washer and dryer readings.' },
    { title: 'Light, dark, or auto', text: 'This button cycles through the themes. Auto follows your device setting.' },
    { title: 'See your dorm', text: 'Choose a dorm to narrow the machines and usage chart.' },
    { title: 'Explore usage by day', text: 'Choose Week for last week’s daily peaks, or pick a day to see its readings.' },
    { title: 'Why are some cycles missing?', text: '' },
    { title: 'Your privacy', text: '' },
  ];
</script>

<section class="tour-card" aria-labelledby="tour-title" aria-live="polite" in:cardTransition|global out:cardTransition|global>
  <div class="tour-copy">
    <h2 id="tour-title" tabindex="-1">{steps[step].title}</h2>
    {#if step === 5}
      <p>SpinSight uses the Greenwald laundry API to show machine status. It doesn’t know whose laundry is in a machine. When you send a report, its contents and relevant troubleshooting details are sent to the maintainer.</p>
      <p>The entire project is <a href="https://github.com/tigeryfan/SpinSight">public on GitHub</a>.</p>
    {:else}<p>{step === 4 ? whyNoLaundryText : steps[step].text}</p>{/if}
  </div>
  <div class="tour-actions">
    {#if step < steps.length - 1}<button class="tour-secondary" onclick={close}>Skip tour</button>{/if}
    {#if step > 0}<button class="tour-secondary" onclick={back}>Back</button>{/if}
    <button class="tour-primary" onclick={next}>{step === steps.length - 1 ? 'Finish' : 'Next'}</button>
  </div>
</section>

<style>
  .tour-card { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 16px 20px; margin-bottom: 16px; border: 1px solid var(--accent); border-radius: var(--radius-panel); background: var(--panel); box-shadow: var(--popover-shadow); }
  .tour-copy h2:focus { outline: none; }
  .tour-copy p { margin: 8px 0 0; color: var(--muted); line-height: 1.6; }
  .tour-copy a { color: var(--ink); text-underline-offset: 3px; }
  .tour-actions { display: flex; align-items: center; gap: 8px; flex: none; }
  button { min-height: 32px; padding: 6px 10px; border: 0; border-radius: var(--radius-control); font-size: 12px; }
  .tour-secondary { background: transparent; color: var(--muted); }
  .tour-secondary:hover { color: var(--ink); }
  .tour-primary { background: var(--selected); color: var(--selected-ink); }
  @media (max-width: 600px) { .tour-card { align-items: stretch; flex-direction: column; gap: 12px; padding: 14px; } .tour-actions { justify-content: flex-end; flex-wrap: wrap; } }
</style>
