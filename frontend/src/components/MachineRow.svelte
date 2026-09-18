<script lang="ts">
  import type { Machine } from '../lib/types';
  import StatusDot from './StatusDot.svelte';
  import { fmtEta } from '../lib/time';

  interface Props {
    machine: Machine;
  }
  let { machine }: Props = $props();

  const accent = $derived(machine.type === 'washer' ? 'var(--washer)' : 'var(--dryer)');

  const etaText = $derived(
    machine.status === 'running'
      ? fmtEta(machine.remainingMinutes)
      : machine.status === 'done'
        ? 'READY'
        : 'IDLE'
  );

  const etaKind = $derived(machine.status);

  // Text flips to dark when there's a fill, so it stays legible on the
  // bright accent fill. Available rows (no fill) stay light on the dark surface.
  const textOnFill = $derived(machine.status !== 'available');
</script>

<li class="row" data-status={machine.status} class:has-fill={textOnFill}>
  {#if textOnFill}
    <div
      class="fill"
      style="width: {machine.progress}%; background: {accent};"
      aria-hidden="true"
    ></div>
  {/if}
  <div class="content">
    <span class="dot-slot">
      <StatusDot status={machine.status} type={machine.type} />
    </span>
    <span class="id mono">{machine.id}</span>
    <span class="eta mono" data-kind={etaKind}>{etaText}</span>
  </div>
</li>

<style>
  .row {
    position: relative;
    list-style: none;
    border-top: 1px solid var(--hairline);
    height: 32px;
    background: var(--ink);
    overflow: hidden;
  }

  .row:first-child {
    border-top: 0;
  }

  .fill {
    position: absolute;
    inset: 0 auto 0 0;
    transition: width 400ms cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 0;
  }

  .row[data-status='done'] .fill {
    background: var(--done) !important;
  }

  .content {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: 16px 1fr auto;
    align-items: center;
    gap: 14px;
    padding: 0 16px;
    height: 100%;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-dim);
    transition: color 120ms ease;
  }

  .dot-slot {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .id {
    font-weight: 500;
    letter-spacing: 0.04em;
    color: var(--text);
  }

  .eta {
    font-weight: 500;
    letter-spacing: 0.04em;
    color: var(--text-dim);
    min-width: 48px;
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-feature-settings: 'tnum' on;
  }

  .eta[data-kind='done'] {
    color: var(--ink);
    font-weight: 600;
  }

  .row.has-fill .id,
  .row.has-fill .eta[data-kind='running'] {
    color: var(--ink);
  }

  .row[data-status='available'] .content {
    color: var(--text-dim);
  }

  .row[data-status='available'] .id {
    color: var(--text-dim);
  }
</style>
