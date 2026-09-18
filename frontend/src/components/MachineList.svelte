<script lang="ts">
  import MachineRow from './MachineRow.svelte';
  import type { Machine } from '../lib/types';

  interface Props {
    machines: Machine[];
    title: string;
  }
  let { machines, title }: Props = $props();

  const statusOrder: Record<Machine['status'], number> = {
    running: 0,
    done: 1,
    available: 2,
  };

  let sorted = $derived(
    [...machines].sort((a, b) => {
      const so = statusOrder[a.status] - statusOrder[b.status];
      if (so !== 0) return so;
      return a.id.localeCompare(b.id);
    })
  );

  let running = $derived(machines.filter((m) => m.status === 'running').length);
  let done = $derived(machines.filter((m) => m.status === 'done').length);
  let available = $derived(machines.filter((m) => m.status === 'available').length);
</script>

<div class="list">
  <header class="head">
    <h2 class="title mono">{title}</h2>
    <div class="counts mono">
      <span class="count" data-kind="running">
        <span class="count-n">{running}</span>
        <span class="count-l">RUN</span>
      </span>
      <span class="count" data-kind="done">
        <span class="count-n">{done}</span>
        <span class="count-l">DONE</span>
      </span>
      <span class="count" data-kind="available">
        <span class="count-n">{available}</span>
        <span class="count-l">FREE</span>
      </span>
    </div>
  </header>
  <ol class="rows">
    {#each sorted as machine (machine.id)}
      <MachineRow {machine} />
    {/each}
  </ol>
</div>

<style>
  .list {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: var(--s-3) var(--s-3) var(--s-2);
    border-top: 0;
  }

  .title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.18em;
    color: var(--text-faint);
    margin: 0;
  }

  .counts {
    display: flex;
    align-items: baseline;
    gap: var(--s-3);
    font-size: 10px;
    letter-spacing: 0.1em;
  }

  .count {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
  }

  .count-n {
    color: var(--text);
    font-weight: 600;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    font-feature-settings: 'tnum' on;
  }

  .count-l {
    color: var(--text-faint);
    font-weight: 500;
    font-size: 9px;
    letter-spacing: 0.16em;
  }

  .count[data-kind='running'] .count-n {
    color: var(--text);
  }
  .count[data-kind='done'] .count-n {
    color: var(--text);
  }
  .count[data-kind='available'] .count-n {
    color: var(--text);
  }

  .rows {
    margin: 0;
    padding: 0;
    list-style: none;
  }
</style>
