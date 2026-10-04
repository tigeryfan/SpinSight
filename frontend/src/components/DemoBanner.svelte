<script lang="ts">
  import { cardTransition } from '../lib/transitions';
  let { onConfirm, onDismiss }: { onConfirm: () => void; onDismiss: () => void } = $props();
</script>

<section class="demo-banner" role="alert" aria-labelledby="demo-banner-title" transition:cardTransition|global>
  <div class="banner-copy">
    <h2 id="demo-banner-title">Demo mode</h2>
    <p>You are in demo mode. SpinSight is showing synthetic data.</p>
  </div>
  <div class="banner-actions">
    <button class="pill banner-primary" onclick={onConfirm}>Exit demo</button>
    <button class="banner-close" aria-label="Dismiss demo notice" onclick={onDismiss}>×</button>
  </div>
</section>

<style>
  .demo-banner { position: sticky; top: 8px; z-index: 18; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 20px; margin-bottom: 16px; border: 1px solid var(--demo-accent); border-radius: var(--radius-panel); background: var(--panel); box-shadow: var(--popover-shadow); }
  .banner-copy h2 { margin: 0; color: var(--demo-accent); line-height: 1.2; }
  .banner-copy p { margin: 4px 0 0; color: var(--muted); line-height: 1.5; }
  .banner-actions { display: inline-flex; align-items: center; gap: 6px; flex: none; align-self: center; }
  .banner-primary { background: var(--demo-accent); color: var(--demo-accent-ink); }
  .banner-close { border: 0; padding: 0 6px; background: transparent; color: var(--muted); font-size: 24px; line-height: 1; cursor: pointer; align-self: center; }
  .banner-close:hover { color: var(--ink); }
  @media (max-width: 600px) { .demo-banner { align-items: stretch; flex-direction: column; padding: 14px; } .banner-actions { justify-content: space-between; align-self: stretch; } }
</style>