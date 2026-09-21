<script lang="ts">
  import { onMount } from 'svelte';
  import DormPicker from './components/DormPicker.svelte';
  import Icon from './components/Icon.svelte';
  import MachineCard from './components/MachineCard.svelte';
  import UsageChart from './components/UsageChart.svelte';
  import { filterMachines, loadSnapshot, summary, usageRank, type Snapshot } from './lib/data';

  type Theme = 'light' | 'dark' | 'system';
  const themes: Theme[] = ['light', 'dark', 'system'];
  let theme = $state<Theme>('system');
  let dorm = $state('All Dorms');
  let snapshot = $state<Snapshot | null>(null);
  let loading = $state(true);
  let error = $state('');
  let announcement = $state('Loading demo machines.');
  let filtered = $derived(filterMachines(snapshot?.machines ?? [], dorm));
  let washers = $derived(summary(filtered, 'Washer'));
  let dryers = $derived(summary(filtered, 'Dryer'));

  async function refresh() {
    loading = true; error = '';
    try {
      snapshot = await loadSnapshot();
      announcement = `Demo data refreshed at ${snapshot.refreshedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}.`;
    } catch {
      error = 'Could not refresh the dashboard. Please try again.';
      announcement = '';
    } finally { loading = false; }
  }
  function cycleTheme() {
    theme = themes[(themes.indexOf(theme) + 1) % themes.length];
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('spinsight-theme', theme); } catch { /* Keep the session preference when storage is blocked. */ }
  }
  onMount(() => {
    try {
      const saved = localStorage.getItem('spinsight-theme');
      if (themes.includes(saved as Theme)) theme = saved as Theme;
    } catch { /* Default to the system theme. */ }
    void refresh();
  });
</script>

<svelte:head><title>SpinSight · {dorm}</title></svelte:head>
<a class="skip-link" href="#machines">Skip to machines</a>
<main class="wrap">
  <header>
    <h1>SpinSight</h1>
    <div class="controls">
      <button class="pill icon-pill" aria-label="Refresh dashboard" title="Refresh dashboard" disabled={loading} onclick={refresh}><span class:spinning={loading}><Icon name="refresh" /></span></button>
      <button class="pill theme-button" aria-label={`Theme: ${theme === 'system' ? 'Auto' : theme}. Switch to ${themes[(themes.indexOf(theme) + 1) % themes.length]}`} title="Cycle light, dark, and system theme" onclick={cycleTheme}><Icon name={theme} /><span>{theme === 'system' ? 'Auto' : theme === 'light' ? 'Light' : 'Dark'}</span></button>
      <DormPicker bind:value={dorm} />
    </div>
  </header>
  <div class="demo-note"><span>Demo data</span><span>{#if loading}{snapshot ? 'Refreshing…' : 'Loading…'}{:else if snapshot}Updated {snapshot.refreshedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}{/if}</span></div>
  <p class="sr-only" role="status">{announcement}</p>
  {#if error}<div class="error" role="alert"><span>{error}</span><button class="text-button" onclick={refresh}>Try again</button></div>{/if}
  <section class="stats" aria-label="Machine availability" aria-busy={loading}>
    {#each [{ label: 'Washers available', data: washers }, { label: 'Dryers available', data: dryers }] as item}
      <div class="stat"><div class="label">{item.label}</div><div class="value">{snapshot ? item.data.available : '—'} <span class="sub">/ {snapshot ? item.data.total : '—'}</span></div></div>
    {/each}
    {#each [{ label: 'Next washer to free up', data: washers }, { label: 'Next dryer to free up', data: dryers }] as item}
      <div class="stat"><div class="label">{item.label}</div><div class="value">{#if !snapshot}—{:else if item.data.next}{item.data.next.machineName} <span class="sub">in {item.data.next.minutesLeft}m</span>{:else}<span class="sub">No active cycles</span>{/if}</div></div>
    {/each}
  </section>
  {#if snapshot}
    <UsageChart machines={filtered} />
  {:else}
    <section class="panel chart-loading" aria-label="Usage chart"><p>{error ? 'Usage history is unavailable.' : 'Loading usage history…'}</p></section>
  {/if}
  <section class="panel machines" id="machines" aria-labelledby="machines-title" aria-busy={loading} tabindex="-1">
    <div class="machines-heading"><h2 id="machines-title">Machines <span class="pill-tag">{dorm}</span></h2><span class="machine-count">{filtered.length} machines</span></div>
    {#if snapshot && filtered.length}
      <div class="grid">
        {#each filtered as machine (machine.id)}
          {@const ranking = usageRank(machine, filtered)}
          <MachineCard {machine} rank={ranking.rank} total={ranking.total} showDorm={dorm === 'All Dorms'} />
        {/each}
      </div>
    {:else}<p class="empty">{loading ? 'Loading machines…' : snapshot ? 'No machines found for this dorm.' : 'Machine data is unavailable. Try refreshing.'}</p>{/if}
  </section>
  <footer>Available counts include completed cycles awaiting unload. All cycle times and usage history are illustrative.</footer>
</main>
