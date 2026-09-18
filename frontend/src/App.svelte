<script lang="ts">
  import DormSelect from './components/DormSelect.svelte';
  import LiveReadout from './components/LiveReadout.svelte';
  import RefreshButton from './components/RefreshButton.svelte';
  import UsageChart from './components/UsageChart.svelte';
  import MachineList from './components/MachineList.svelte';
  import { getDorms, getCurrentDorm, getWeeklyUsage } from './lib/state.svelte';
  import type { Machine } from './lib/types';

  // Minute-tick drives ETA countdown for running machines.
  let now = $state(Date.now());
  $effect(() => {
    const id = setInterval(() => {
      now = Date.now();
    }, 60_000);
    return () => clearInterval(id);
  });

  function countByStatus(machines: Machine[], status: Machine['status']): number {
    let n = 0;
    for (const m of machines) if (m.status === status) n++;
    return n;
  }

  let dorms = $derived(getDorms());
  let currentDorm = $derived(getCurrentDorm());
  let weeklyUsage = $derived(getWeeklyUsage());

  let washers = $derived(currentDorm?.machines.filter((m) => m.type === 'washer') ?? []);
  let dryers = $derived(currentDorm?.machines.filter((m) => m.type === 'dryer') ?? []);
  let washersAvailable = $derived(countByStatus(washers, 'available'));
  let washersBusy = $derived(countByStatus(washers, 'running') + countByStatus(washers, 'done'));
  let dryersAvailable = $derived(countByStatus(dryers, 'available'));
  let dryersBusy = $derived(countByStatus(dryers, 'running') + countByStatus(dryers, 'done'));
</script>

<svelte:head>
  <title>SpinSight · {currentDorm?.name ?? '—'}</title>
</svelte:head>

<main>
  <header class="header">
    <div class="cell dorm">
      <DormSelect dorms={dorms} selectedId={currentDorm?.id ?? ''} />
    </div>
    <div class="cell readout hairline-left">
      <LiveReadout
        label="WASHERS"
        type="washer"
        available={washersAvailable}
        busy={washersBusy}
      />
    </div>
    <div class="cell readout hairline-left">
      <LiveReadout
        label="DRYERS"
        type="dryer"
        available={dryersAvailable}
        busy={dryersBusy}
      />
    </div>
    <div class="cell refresh hairline-left">
      <RefreshButton />
    </div>
  </header>

  <section class="charts hairline-bottom">
    {#if weeklyUsage}
      <UsageChart usage={weeklyUsage} />
    {/if}
  </section>

  <section class="machines">
    <div class="machine-col">
      <MachineList machines={washers} title="WASHERS" />
    </div>
    <div class="machine-col hairline-left">
      <MachineList machines={dryers} title="DRYERS" />
    </div>
  </section>

  <footer class="status-bar hairline-top mono">
    <span class="sb-cell">{currentDorm?.name?.toUpperCase() ?? '—'}</span>
    <span class="sb-cell hairline-left">LIVE · MOCK DATA</span>
    <span class="sb-cell hairline-left">{new Date(now).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
    <span class="sb-cell hairline-left sb-spacer"></span>
    <span class="sb-cell hairline-left">
      <span class="legend"><span class="swatch swatch-washer"></span>WASHER</span>
      <span class="legend-sep">·</span>
      <span class="legend"><span class="swatch swatch-dryer"></span>DRYER</span>
    </span>
  </footer>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    width: 100%;
    max-width: 1440px;
    margin: 0 auto;
    padding: 0 var(--s-4);
  }

  .header {
    display: grid;
    grid-template-columns: minmax(240px, 1fr) auto auto auto;
    align-items: stretch;
    min-height: 112px;
    padding: var(--s-4) 0;
    gap: 0;
  }

  .cell {
    display: flex;
    align-items: center;
    padding: 0 var(--s-3);
  }

  .cell:first-child {
    padding-left: 0;
  }

  .cell.refresh {
    justify-content: flex-end;
  }

  .charts {
    padding: var(--s-4) 0 var(--s-5);
  }

  .machines {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: stretch;
    flex: 1;
  }

  .machine-col {
    padding: 0;
  }

  .machine-col:first-child {
    padding-right: 0;
  }
  .status-bar {
    display: grid;
    grid-template-columns: auto auto auto 1fr auto;
    align-items: center;
    font-size: 10px;
    letter-spacing: 0.12em;
    color: var(--text-faint);
    min-height: 32px;
    margin-top: var(--s-3);
  }

  .sb-cell {
    padding: 0 var(--s-3);
    display: flex;
    align-items: center;
    gap: var(--s-2);
    height: 100%;
    line-height: 32px;
  }

  .legend {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--text-dim);
  }

  .legend-sep {
    color: var(--text-faint);
    margin: 0 4px;
  }

  .swatch {
    width: 10px;
    height: 10px;
    display: inline-block;
  }

  .swatch-washer {
    background: var(--washer);
  }

  .swatch-dryer {
    background: var(--dryer);
  }

  @media (max-width: 720px) {
    main {
      padding: 0 var(--s-3);
    }

    .header {
      grid-template-columns: 1fr;
      grid-auto-rows: auto;
      min-height: 0;
    }

    .cell {
      padding: var(--s-3) 0;
      border-left: 0 !important;
    }

    .cell:not(:first-child) {
      border-top: 1px solid var(--hairline);
    }

    .cell.refresh {
      justify-content: flex-start;
    }

    .charts {
      padding: var(--s-3) 0 var(--s-4);
    }

    .machines {
      grid-template-columns: 1fr;
    }

    .machine-col {
      border-left: 0 !important;
    }

    .machine-col:not(:first-child) {
      border-top: 1px solid var(--hairline);
    }

    .status-bar {
      grid-template-columns: 1fr 1fr;
      font-size: 9px;
    }

    .status-bar .sb-cell:nth-child(n + 3) {
      display: none;
    }

    .sb-spacer {
      display: none;
    }
  }
</style>
