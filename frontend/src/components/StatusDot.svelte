<script lang="ts">
  import type { MachineStatus, MachineType } from '../lib/types';

  interface Props {
    status: MachineStatus;
    type: MachineType;
  }
  let { status, type }: Props = $props();

  const color = $derived(
    status === 'available'
      ? 'var(--available)'
      : status === 'done'
        ? 'var(--done)'
        : type === 'washer'
          ? 'var(--washer)'
          : 'var(--dryer)'
  );

  const label = $derived(
    status === 'available'
      ? 'Available'
      : status === 'done'
        ? 'Done'
        : `Running ${type}`
  );
</script>

<span
  class="dot"
  class:pulse={status === 'running'}
  style="--c: {color};"
  role="img"
  aria-label={label}
>
  <span class="hl"></span>
</span>

<style>
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--c);
    position: relative;
    display: inline-block;
    flex-shrink: 0;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.18);
  }

  .hl {
    position: absolute;
    top: 1.5px;
    left: 1.5px;
    width: 2.5px;
    height: 2.5px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.55);
    pointer-events: none;
  }

  .dot.pulse {
    animation: pulse 1800ms ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.55;
    }
  }
</style>
