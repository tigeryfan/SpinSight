<script lang="ts">
  import { untrack } from 'svelte';
  import type { MachineType } from '../lib/types';

  interface Props {
    label: string;
    type: MachineType;
    available: number;
    busy: number;
  }
  let { label, type, available, busy }: Props = $props();

  // Refresh fade: when underlying values change, fade out, swap, fade in.
  let display = $state(untrack(() => ({ available, busy })));
  let prev = untrack(() => ({ available, busy }));
  let fading = $state(false);

  $effect(() => {
    if (prev.available !== available || prev.busy !== busy) {
      fading = true;
      const t = setTimeout(() => {
        display = { available, busy };
        fading = false;
      }, 120);
      prev = { available, busy };
      return () => clearTimeout(t);
    }
  });
</script>

<div class="readout" data-type={type}>
  <div class="label-row">
    <span class="marker" data-type={type} aria-hidden="true"></span>
    <span class="label mono">{label}</span>
  </div>
  <div class="number mono" class:fading>{display.available}<span class="of">/{display.available + display.busy}</span></div>
  <div class="sub mono">
    <span class="sub-val">{display.busy}</span>
    <span class="sub-lbl">IN USE</span>
  </div>
</div>

<style>
  .readout {
    display: grid;
    grid-template-rows: auto 1fr auto;
    gap: 4px;
    padding: 4px var(--s-4);
    min-width: 180px;
  }

  .label-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .marker {
    width: 6px;
    height: 6px;
    display: inline-block;
  }

  .marker[data-type='washer'] {
    background: var(--washer);
  }
  .marker[data-type='dryer'] {
    background: var(--dryer);
  }

  .label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.16em;
    color: var(--text-faint);
  }

  .number {
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 44px;
    line-height: 1;
    color: var(--text);
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    font-feature-settings: 'tnum' on;
    transition: opacity 120ms ease;
  }

  .number.fading {
    opacity: 0;
  }

  .of {
    color: var(--text-faint);
    font-weight: 400;
    font-size: 24px;
    margin-left: 4px;
    letter-spacing: 0;
  }

  .sub {
    display: flex;
    align-items: baseline;
    gap: 8px;
    color: var(--text-dim);
    font-size: 11px;
    letter-spacing: 0.08em;
  }

  .sub-val {
    font-weight: 600;
    color: var(--text);
    font-variant-numeric: tabular-nums;
    font-feature-settings: 'tnum' on;
  }

  .sub-lbl {
    color: var(--text-faint);
    font-size: 10px;
    letter-spacing: 0.16em;
    font-weight: 500;
  }

  @media (max-width: 720px) {
    .readout {
      padding: var(--s-2) var(--s-3);
      min-width: 0;
    }
    .number {
      font-size: 36px;
    }
    .of {
      font-size: 20px;
    }
  }
</style>
