<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import DormPicker from './components/DormPicker.svelte';
  import Icon from './components/Icon.svelte';
  import MachineCard from './components/MachineCard.svelte';
  import UsageChart from './components/UsageChart.svelte';
  import { deriveMachines, filterMachines, loadSnapshot, refreshSnapshot, summary, usageRank, type Snapshot } from './lib/data';

  type Theme = 'light' | 'dark' | 'system';
  const themes: Theme[] = ['light', 'dark', 'system'];
  function themeFade(node: Element) {
    return fade(node, {
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220,
      easing: cubicOut,
    });
  }
  let theme = $state<Theme>('system');
  let dorm = $state('All Dorms');
  let snapshot = $state<Snapshot | null>(null);
  let dataRevision = $state(0);
  let loading = $state(true);
  let refreshSpinning = $state(false);
  let refreshIcon: HTMLSpanElement;
  let error = $state('');
  let announcement = $state('Loading machines.');
  let now = $state(Date.now());
  let requestPending = false;
  let retryRefresh = false;
  let dorms = $derived([...new Set((snapshot?.machines ?? []).map(machine => machine.dorm))].sort());
  let storedMachines = $derived(filterMachines(snapshot?.machines ?? [], dorm));
  let filtered = $derived(deriveMachines(storedMachines, now));
  let washers = $derived(summary(filtered, 'Washer'));
  let dryers = $derived(summary(filtered, 'Dryer'));

  function startRefreshSpin() {
    if (!refreshSpinning && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) refreshSpinning = true;
  }

  async function readData(scrape = false) {
    if (requestPending) return;
    requestPending = true;
    retryRefresh = scrape;
    loading = true; error = '';
    try {
      snapshot = await (scrape ? refreshSnapshot() : loadSnapshot());
      dataRevision += 1;
      now = Date.now();
      if (dorm !== 'All Dorms' && !snapshot.machines.some(machine => machine.dorm === dorm)) dorm = 'All Dorms';
      announcement = snapshot.refreshedAt
        ? `Data last updated ${snapshot.refreshedAt.toLocaleString()}.`
        : 'No machine readings are available yet.';
    } catch {
      error = scrape ? 'Could not refresh the machines. Please try again.' : 'Could not load machine data. Please try again.';
      announcement = '';
    } finally { loading = false; requestPending = false; }
  }
  function cycleTheme() {
    theme = themes[(themes.indexOf(theme) + 1) % themes.length];
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('spinsight-theme', theme); } catch { /* Keep the session preference when storage is blocked. */ }
  }
  onMount(() => {
    const stopRefreshSpin = () => refreshSpinning = false;
    refreshIcon.addEventListener('animationcancel', stopRefreshSpin);
    try {
      const saved = localStorage.getItem('spinsight-theme');
      if (themes.includes(saved as Theme)) theme = saved as Theme;
    } catch { /* Default to the system theme. */ }
    const updateClock = () => now = Date.now();
    const timer = window.setInterval(updateClock, 1000);
    document.addEventListener('visibilitychange', updateClock);
    void readData();
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', updateClock);
      refreshIcon.removeEventListener('animationcancel', stopRefreshSpin);
    };
  });
</script>

<svelte:head><title>SpinSight · {dorm}</title></svelte:head>
<a class="skip-link" href="#machines">Skip to machines</a>
<main class="wrap">
  <header>
    <div class="brand">
      <h1>SpinSight</h1>
      <div class="update-note">
        {#if loading}
          <span>{snapshot ? 'Refreshing…' : 'Loading…'}</span>
        {:else if snapshot?.refreshedAt}
          <span>Updated</span>{' '}<span class="update-date">{snapshot.refreshedAt.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
        {:else if snapshot}
          <span>No readings yet</span>
        {/if}
      </div>
    </div>
    <div class="controls">
      <button class="pill icon-pill" aria-label="Refresh dashboard" title="Refresh dashboard" disabled={loading}
        onpointerdown={(event) => { if (event.button === 0) startRefreshSpin(); }}
        onclick={(event) => { if (event.detail === 0) startRefreshSpin(); void readData(true); }}>
        <span class="refresh-icon" bind:this={refreshIcon} class:spinning={refreshSpinning} onanimationend={() => refreshSpinning = false}><Icon name="refresh" /></span>
      </button>
      <button class="pill theme-button" aria-label={`Theme: ${theme === 'system' ? 'Auto' : theme}. Switch to ${themes[(themes.indexOf(theme) + 1) % themes.length]}`} title="Cycle light, dark, and system theme" onclick={cycleTheme}>
        <span class="theme-content" aria-hidden="true">
          {#key theme}
            <span class="theme-option" transition:themeFade><Icon name={theme} /><span>{theme === 'system' ? 'Auto' : theme === 'light' ? 'Light' : 'Dark'}</span></span>
          {/key}
        </span>
      </button>
      <DormPicker bind:value={dorm} {dorms} />
    </div>
  </header>
  <p class="sr-only" role="status">{announcement}</p>
  {#if error}<div class="error" role="alert"><span>{error}</span><button class="text-button" disabled={loading} onclick={() => readData(retryRefresh)}>Try again</button></div>{/if}
  <section class="stats" aria-label="Machine availability" aria-busy={loading}>
    {#each [{ label: 'Washers available', data: washers }, { label: 'Dryers available', data: dryers }] as item}
      <div class="stat"><div class="label">{item.label}</div><div class="value">{snapshot ? item.data.available : '—'} <span class="sub">/ {snapshot ? item.data.total : '—'}</span></div></div>
    {/each}
    {#each [{ label: 'Next washer', data: washers }, { label: 'Next dryer', data: dryers }] as item}
      <div class="stat"><div class="label">{item.label}</div><div class="value">{#if !snapshot}—{:else if item.data.next}{item.data.next.machineName} <span class="sub">in {item.data.next.minutesLeft}m</span>{:else}{#if item.data.total > 0 && item.data.available === item.data.total}<span class="all-available">All available</span>{:else}<span class="sub">{item.data.total ? 'Time unknown' : 'No machines'}</span>{/if}{/if}</div></div>
    {/each}
  </section>
  {#if snapshot}
    <UsageChart machines={storedMachines} history={snapshot.history} dates={snapshot.dates} animationKey={dataRevision} />
  {:else}
    <section class="panel chart-loading" aria-label="Usage chart"><p>{error ? 'Usage history is unavailable.' : 'Loading usage history…'}</p></section>
  {/if}
  <section class="panel machines" id="machines" aria-labelledby="machines-title" aria-busy={loading} tabindex="-1">
    <div class="machines-heading"><h2 id="machines-title">Machines</h2><span class="machine-count">{filtered.length} machines</span></div>
    {#if snapshot && filtered.length}
      <div class="grid">
        {#each filtered as machine (machine.id)}
          {@const ranking = usageRank(machine, filtered)}
          <MachineCard {machine} {ranking} showDorm={dorm === 'All Dorms'} animationKey={dataRevision} />
        {/each}
      </div>
    {:else}<p class="empty">{loading ? 'Loading machines…' : snapshot ? 'No machines found for this dorm.' : 'Machine data is unavailable. Try refreshing.'}</p>{/if}
  </section>
</main>
