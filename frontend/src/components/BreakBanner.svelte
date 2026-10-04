<script lang="ts">
  import { cardTransition } from '../lib/transitions';
  let { onConfirm, onDismiss }: { onConfirm: () => void; onDismiss: () => void } = $props();
</script>

<section class="break-banner" role="alert" aria-labelledby="break-banner-title" transition:cardTransition|global>
  <div class="banner-copy">
    <h2 id="break-banner-title">We're on break</h2>
    <p>Greenwald isn't reporting readings, so the dashboard is empty. Want to try demo data instead?</p>
  </div>
  <div class="banner-actions">
    <button class="pill banner-primary" onclick={onConfirm}>Try demo data</button>
    <button class="banner-close" aria-label="Dismiss break notice" onclick={onDismiss}>×</button>
  </div>
</section>

<style>
  .break-banner { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 20px; margin-bottom: 16px; border: 1px solid var(--warn); border-radius: var(--radius-panel); background: var(--panel); box-shadow: var(--popover-shadow); }
  .banner-copy h2 { margin: 0; }
  .banner-copy p { margin: 4px 0 0; color: var(--muted); line-height: 1.5; }
  .banner-actions { display: inline-flex; align-items: center; gap: 8px; flex: none; }
  .banner-primary { background: var(--selected); color: var(--selected-ink); }
  .banner-close { border: 0; padding: 0 6px; background: transparent; color: var(--muted); font-size: 24px; line-height: 1; cursor: pointer; }
  .banner-close:hover { color: var(--ink); }
  @media (max-width: 600px) { .break-banner { align-items: stretch; flex-direction: column; padding: 14px; } .banner-actions { justify-content: space-between; } }
</style>