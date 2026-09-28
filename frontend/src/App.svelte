<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { cardTransition } from './lib/transitions';
  import DormPicker from './components/DormPicker.svelte';
  import SelectMenu from './components/SelectMenu.svelte';
  import Icon from './components/Icon.svelte';
  import MachineCard from './components/MachineCard.svelte';
  import MachineReport from './components/MachineReport.svelte';
  import TourCard from './components/TourCard.svelte';
  import ChallengeCard from './components/ChallengeCard.svelte';
  import UsageChart from './components/UsageChart.svelte';
  import { ChallengeRequiredError, VerificationFailedError, deriveMachines, filterMachines, loadSnapshot, probeDashboardConnection, refreshSnapshot, summary, usageRank, type Machine, type Snapshot } from './lib/data';
  import { loadTurnstile, turnstileSitekey, type TurnstileApi } from './lib/turnstile';
  import { cookieValue, preferenceCookie, selectDorm } from './lib/preferences';
  import { dorms, isUnassignedDorm } from './lib/dorms';

  type Theme = 'light' | 'dark' | 'system';
  const themes: Theme[] = ['light', 'dark', 'system'];
  function softFade(node: Element) {
    return fade(node, {
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220,
      easing: cubicOut,
    });
  }
  let theme = $state<Theme>('system');
  let systemDark = $state(window.matchMedia('(prefers-color-scheme: dark)').matches);
  let resolvedTheme: 'light' | 'dark' = $derived(theme === 'dark' || (theme === 'system' && systemDark) ? 'dark' : 'light');
  $effect(() => {
    const favicon = document.querySelector<HTMLLinkElement>('#favicon');
    if (favicon) favicon.href = resolvedTheme === 'dark' ? '/favicon-light.svg' : '/favicon-dark.svg';
  });
  let tourStep = $state(-2);
  function dismissTourInvite(node: Element) {
    return tourStep >= 0 ? { duration: 0 } : cardTransition(node);
  }
  let privacyVisible = $state(false);
  let problemVisible = $state(false);
  async function showProblem() {
    problemVisible = true;
    await tick();
    document.getElementById('problem-description')?.focus();
  }
  function showAllDorms(event: MouseEvent) {
    event.preventDefault();
    dorm = 'All Dorms';
    dormReady = true;
    const url = new URL(window.location.href);
    url.searchParams.set('dorm', dorm);
    url.hash = '';
    window.history.replaceState(null, '', url);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  async function showPrivacy(event: MouseEvent) {
    event.preventDefault();
    whyNoLaundryVisible = false;
    privacyVisible = true;
    await tick();
    const card = document.getElementById('privacy');
    card?.focus({ preventScroll: true });
    card?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  async function showWhyNoLaundry(event: MouseEvent) {
    event.preventDefault();
    privacyVisible = false;
    whyNoLaundryVisible = true;
    await tick();
    const card = document.getElementById('why-no-laundry');
    card?.focus({ preventScroll: true });
    card?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  let whyNoLaundryVisible = $state(false);
  const whyNoLaundryText = 'Cycles run without payment are not tracked because they do not exist in the Greenwald system.';
  let dorm = $state('All Dorms');
  let snapshot = $state<Snapshot | null>(null);
  let dataRevision = $state(0);
  let loading = $state(true);
  let refreshSpinning = $state(false);
  let error = $state('');
  let announcement = $state('Loading machines.');
  let now = $state(Date.now());
  let requestPending = false;
  let retryRefresh = false;
  let challengeVisible = $state(false);
  let debugTurnstile = $state(false);
  let backgroundToken: string | null = null;
  let backgroundWaiters: Array<(token: string | null) => void> = [];
  let backgroundApi: TurnstileApi | null = null;
  let backgroundWidgetId: string | null = null;
  let backgroundContainer: HTMLDivElement;
  let dormReady = $state(false);
  let requestedDorm: string | null = null;
  let savedDorm: string | null = null;
  let storedMachines = $derived(filterMachines(snapshot?.machines ?? [], dorm));
  let filtered = $derived(deriveMachines(storedMachines, now));
  let machineSort = $state('name-asc');
  const machineSortOptions = [
    { value: 'name-asc', label: 'Name A-Z' },
    { value: 'name-desc', label: 'Name Z-A' },
    { value: 'usage-desc', label: 'Usage High-Low' },
    { value: 'usage-asc', label: 'Usage Low-High' },
  ];
  let sortedMachines = $derived([...filtered].sort(compareMachines));
  function compareMachines(a: Machine, b: Machine) {
    const byName = a.machineName.localeCompare(b.machineName, undefined, { numeric: true });
    if (machineSort.startsWith('usage-')) {
      if (a.usageHoursPastWeek === null && b.usageHoursPastWeek !== null) return 1;
      if (b.usageHoursPastWeek === null && a.usageHoursPastWeek !== null) return -1;
      const byUsage = (a.usageHoursPastWeek ?? 0) - (b.usageHoursPastWeek ?? 0);
      return (machineSort === 'usage-asc' ? byUsage : -byUsage) || byName || a.id.localeCompare(b.id);
    }
    return (machineSort === 'name-desc' ? -byName : byName) || a.id.localeCompare(b.id);
  }
  let washers = $derived(summary(filtered, 'Washer'));
  let dryers = $derived(summary(filtered, 'Dryer'));

  function startRefreshSpin() {
    if (!refreshSpinning && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) refreshSpinning = true;
  }
  function debugAlert(message: string) {
    if (debugTurnstile) window.alert(`Turnstile debug\n\n${message}`);
  }
  function errorMessage(cause: unknown): string {
    return cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
  }

  function receiveBackgroundToken(token: string | null) {
    backgroundToken = token;
    for (const resolve of backgroundWaiters.splice(0)) resolve(token);
  }
  function stopBackgroundCheck() {
    receiveBackgroundToken(null);
    if (backgroundApi && backgroundWidgetId) backgroundApi.remove(backgroundWidgetId);
    backgroundWidgetId = null;
  }
  async function prepareBackgroundCheck() {
    if (backgroundWidgetId) return;
    try {
      backgroundApi = await loadTurnstile();
      if (challengeVisible || backgroundWidgetId) return;
      backgroundWidgetId = backgroundApi.render(backgroundContainer, {
        sitekey: turnstileSitekey,
        action: 'refresh_background',
        appearance: 'interaction-only',
        theme: resolvedTheme,
        callback: token => { receiveBackgroundToken(token); debugAlert('Background check passed in the browser. A token is ready for Refresh.'); },
        'error-callback': () => { stopBackgroundCheck(); debugAlert('Background check failed. Refresh will open the visible challenge card.'); },
        'before-interactive-callback': () => { stopBackgroundCheck(); debugAlert('Background check needs interaction. Refresh will open the visible challenge card.'); },
        'expired-callback': () => {
          receiveBackgroundToken(null);
          if (backgroundApi && backgroundWidgetId) backgroundApi.reset(backgroundWidgetId);
          debugAlert('Background token expired. The background check is restarting.');
        },
      });
    } catch (cause) {
      receiveBackgroundToken(null);
      debugAlert(`Background check could not load: ${errorMessage(cause)}`);
    }
  }
  $effect(() => {
    resolvedTheme;
    if (backgroundWidgetId) {
      stopBackgroundCheck();
      if (!challengeVisible) void prepareBackgroundCheck();
    }
  });
  async function takeBackgroundToken(): Promise<string | null> {
    if (backgroundToken) { const token = backgroundToken; backgroundToken = null; return token; }
    if (!backgroundWidgetId) return null;
    return new Promise(resolve => {
      const timer = window.setTimeout(() => {
        backgroundWaiters = backgroundWaiters.filter(waiter => waiter !== done);
        resolve(null);
        debugAlert('Background check did not produce a token within 10 seconds. Refresh will open the visible challenge card.');
      }, 10_000);
      const done = (token: string | null) => { window.clearTimeout(timer); backgroundToken = null; resolve(token); };
      backgroundWaiters.push(done);
    });
  }
  function resetBackgroundCheck() {
    backgroundToken = null;
    if (backgroundApi && backgroundWidgetId) backgroundApi.reset(backgroundWidgetId);
  }
  function applySnapshot(next: Snapshot) {
    snapshot = next;
    dataRevision += 1;
    now = Date.now();
    if (!dormReady) {
      dorm = selectDorm(dorms, requestedDorm, savedDorm);
      dormReady = true;
    }
    announcement = snapshot.refreshedAt
      ? `Data last updated ${snapshot.refreshedAt.toLocaleString()}.`
      : 'No machine readings are available yet.';
  }
  async function readData() {
    if (requestPending) return;
    requestPending = true;
    retryRefresh = false;
    loading = true; error = '';
    try {
      applySnapshot(await loadSnapshot());
    } catch (cause) {
      if (debugTurnstile) {
        let probeResult: string;
        try { probeResult = `HTTP ${await probeDashboardConnection()}`; }
        catch (probeCause) { probeResult = errorMessage(probeCause); }
        error = `${errorMessage(cause)}; small API request: ${probeResult}`;
      } else {
        error = 'Could not load machine data. Please try again.';
      }
      announcement = '';
    } finally { loading = false; requestPending = false; }
  }
  function finishRefresh() { loading = false; requestPending = false; refreshSpinning = false; }
  async function refreshDashboard() {
    if (requestPending) return;
    requestPending = true;
    retryRefresh = true;
    loading = true; error = '';
    startRefreshSpin();
    const token = await takeBackgroundToken();
    try {
      applySnapshot(await refreshSnapshot(token ?? '', 'background'));
      debugAlert('Refresh allowed. The Worker verified the background token, and this browser has no active rapid-refresh challenge window. No visible challenge was needed.');
      resetBackgroundCheck();
      finishRefresh();
    } catch (cause) {
      if (!token || cause instanceof ChallengeRequiredError) {
        stopBackgroundCheck();
        challengeVisible = true;
        debugAlert(!token
          ? 'Refresh needs the visible challenge because the background check produced no token.'
          : cause instanceof ChallengeRequiredError && cause.reason === 'rate_limit'
            ? 'Refresh needs the visible challenge because this browser made more than three refresh clicks in one minute. It stays required until three minutes after the last click.'
            : 'Refresh needs the visible challenge because the Worker did not accept the background token.');
        return;
      }
      resetBackgroundCheck();
      debugAlert(`Refresh failed after the background token was submitted: ${errorMessage(cause)}`);
      error = debugTurnstile ? errorMessage(cause) : 'Could not refresh the machines. Please try again.';
      finishRefresh();
    }
  }
  async function completeChallenge(token: string): Promise<boolean> {
    requestPending = true;
    loading = true;
    error = '';
    startRefreshSpin();
    try {
      applySnapshot(await refreshSnapshot(token, 'challenge'));
      challengeVisible = false;
      debugAlert('Visible challenge accepted by the Worker. The refresh completed.');
      finishRefresh();
      void prepareBackgroundCheck();
      return true;
    } catch (cause) {
      debugAlert(cause instanceof VerificationFailedError
        ? `Visible challenge token was rejected by the Worker: ${errorMessage(cause)}`
        : `Refresh failed after the visible challenge token was submitted: ${errorMessage(cause)}`);
      return false;
    }
  }
  function cycleTheme() {
    theme = themes[(themes.indexOf(theme) + 1) % themes.length];
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    document.cookie = preferenceCookie('spinsight-theme', theme);
  }
  $effect(() => {
    if (dormReady) document.cookie = preferenceCookie('spinsight-dorm', dorm);
  });
  function rememberTour() {
    document.cookie = 'spinsight-tour=seen; Max-Age=31536000; Path=/; SameSite=Lax';
  }
  async function showTourStep(step: number) {
    tourStep = step;
    await tick();
    document.querySelector<HTMLElement>('#tour-title')?.focus();
  }
  function startTour() {
    void showTourStep(0);
  }
  function closeTour() {
    rememberTour();
    tourStep = -2;
  }
  function nextTourStep() {
    if (tourStep === 5) closeTour();
    else void showTourStep(tourStep + 1);
  }
  onMount(() => {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = () => { systemDark = systemTheme.matches; };
    systemTheme.addEventListener('change', updateSystemTheme);
    debugTurnstile = new URLSearchParams(window.location.search).has('debug');
    let savedTheme = cookieValue(document.cookie, 'spinsight-theme');
    if (!savedTheme) {
      try { savedTheme = localStorage.getItem('spinsight-theme'); }
      catch { /* Default to the system theme. */ }
    }
    if (themes.includes(savedTheme as Theme)) theme = savedTheme as Theme;
    document.cookie = preferenceCookie('spinsight-theme', theme);
    savedDorm = cookieValue(document.cookie, 'spinsight-dorm');
    requestedDorm = new URLSearchParams(window.location.search).get('dorm');
    const seenTour = document.cookie.split(';').some(cookie => cookie.trim() === 'spinsight-tour=seen');
    if (new URLSearchParams(window.location.search).has('tour')) startTour();
    else if (!seenTour) tourStep = -1;
    const updateClock = () => now = Date.now();
    const timer = window.setInterval(updateClock, 1000);
    document.addEventListener('visibilitychange', updateClock);
    void readData();
    void prepareBackgroundCheck();
    return () => {
      systemTheme.removeEventListener('change', updateSystemTheme);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', updateClock);
      if (backgroundApi && backgroundWidgetId) backgroundApi.remove(backgroundWidgetId);
    };
  });
</script>

<svelte:head><title>SpinSight · {dorm}</title></svelte:head>
{#snippet privacyCard()}
  <section class="panel privacy-card" id="privacy" aria-labelledby="privacy-title" tabindex="-1" transition:cardTransition|global>
    <div class="info-card-heading"><h2 id="privacy-title">Privacy</h2><button class="info-card-close" aria-label="Close privacy" onclick={() => privacyVisible = false}>×</button></div>
    <p>SpinSight uses the Greenwald laundry API to show machine status. It doesn’t know whose laundry is in a machine.</p>
    <p>When you send a report, its contents and relevant troubleshooting details are sent to the maintainer.</p>
    <p>The entire project is <a href="https://github.com/tigeryfan/SpinSight">public on GitHub</a>.</p>
  </section>
{/snippet}
{#snippet whyNoLaundryCard()}
  <section class="panel why-no-laundry" id="why-no-laundry" aria-labelledby="why-no-laundry-title" tabindex="-1" transition:cardTransition|global>
    <div class="info-card-heading"><h2 id="why-no-laundry-title">Why are some cycles missing?</h2><button class="info-card-close" aria-label="Close missing data" onclick={() => whyNoLaundryVisible = false}>×</button></div>
    <p>{whyNoLaundryText}</p>
  </section>
{/snippet}
<a class="skip-link" href="#machines">Skip to machines</a>
<main class="wrap">
  {#if tourStep >= 0 && tourStep <= 3}<div class="tour-backdrop" aria-hidden="true" transition:softFade></div>{/if}
  <header>
    <div class="brand">
      <h1><a class="brand-home" href="?dorm=All%20Dorms" onclick={showAllDorms}><svg class="brand-logo" viewBox="4 4 56 56" aria-hidden="true" focusable="false"><circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" stroke-width="8"/><path d="M8 32 C16 25 24 25 32 32 C40 39 48 39 56 32" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/></svg><span>SpinSight</span></a></h1>
      <div class="update-note">
        {#if loading}
          <span>{snapshot ? 'Refreshing…' : 'Loading…'}</span>
        {:else if snapshot?.refreshedAt}
          {@const updatedDate = snapshot.refreshedAt.toLocaleDateString([], { month: 'short', day: 'numeric' })}
          {@const updatedTime = snapshot.refreshedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          <span class="update-label">Updated</span>{' '}<span class="update-date"><span class="date-part">{updatedDate} at</span> <span>{updatedTime}</span></span>
        {:else if snapshot}
          <span>No readings yet</span>
        {/if}
      </div>
    </div>
    <div class="controls">
      <button class="pill icon-pill" class:tour-target={tourStep === 0} aria-label="Refresh dashboard" title="Refresh dashboard" disabled={loading || challengeVisible}
        onclick={() => { void refreshDashboard(); }}>
        <span class="refresh-icon" class:spinning={refreshSpinning}><Icon name="refresh" /></span>
      </button>
      <button class="pill theme-button" class:tour-target={tourStep === 1} aria-label={`Theme: ${theme === 'system' ? 'Auto' : theme}. Switch to ${themes[(themes.indexOf(theme) + 1) % themes.length]}`} title="Cycle light, dark, and system theme" onclick={cycleTheme}>
        <span class="theme-content" aria-hidden="true">
          {#key theme}
            <span class="theme-option" transition:softFade><Icon name={theme} /><span class="theme-label">{theme === 'system' ? 'Auto' : theme === 'light' ? 'Light' : 'Dark'}</span></span>
          {/key}
        </span>
      </button>
      <DormPicker bind:value={dorm} {dorms} highlighted={tourStep === 2} onSelect={(selected) => {
        const url = new URL(window.location.href);
        url.searchParams.set('dorm', selected);
        window.history.replaceState(null, '', url);
      }} />
    </div>
  </header>
  <div class="background-verification" bind:this={backgroundContainer}></div>
  {#if challengeVisible}<ChallengeCard solved={completeChallenge} debug={debugTurnstile} theme={resolvedTheme} />{/if}
  {#if tourStep === -1}
    <section class="tour-invite" role="alert" aria-labelledby="tour-invite-title" in:cardTransition out:dismissTourInvite>
      <div><h2 id="tour-invite-title">Welcome to SpinSight</h2><p>Want a quick tour of the dashboard?</p></div>
      <div class="tour-invite-actions"><button class="pill" onclick={closeTour}>No thanks</button><button class="pill tour-start" onclick={startTour}>Start tour</button></div>
    </section>
  {:else if tourStep >= 0 && tourStep <= 5}
    <TourCard step={tourStep} {whyNoLaundryText} next={nextTourStep} back={() => void showTourStep(tourStep - 1)} close={closeTour} />
  {/if}
  {#if privacyVisible}{@render privacyCard()}{/if}
  {#if whyNoLaundryVisible}{@render whyNoLaundryCard()}{/if}
  <p class="sr-only" role="status">{announcement}</p>
  {#if error}<div class="error" role="alert" transition:cardTransition><span>{error}</span><button class="text-button" disabled={loading} onclick={() => retryRefresh ? refreshDashboard() : readData()}>Try again</button></div>{/if}
  {#if isUnassignedDorm(dorm)}
    <section class="panel assignment-help" id="machines" aria-labelledby="machines-title" tabindex="-1">
      <h2 id="machines-title">No machines assigned to {dorm} yet</h2>
      <p>We need your help identifying this dorm’s washers and dryers. Enter the machine IDs you see on them.</p>
      {#key dorm}<MachineReport {dorm} theme={resolvedTheme} debug={debugTurnstile} />{/key}
    </section>
  {:else}
  <section class="stats" aria-label="Machine availability" aria-busy={loading}>
    {#each [{ label: 'Washers available', data: washers }, { label: 'Dryers available', data: dryers }] as item}
      <div class="stat"><div class="label">{item.label}</div><div class="value">{snapshot ? item.data.available : '—'} <span class="sub">/ {snapshot ? item.data.total : '—'}</span></div></div>
    {/each}
    {#each [{ label: 'Next washer', data: washers }, { label: 'Next dryer', data: dryers }] as item}
      <div class="stat"><div class="label">{item.label}</div><div class="value">{#if !snapshot}—{:else if item.data.next}{item.data.next.machineName} <span class="sub">in {item.data.next.minutesLeft}m</span>{:else}{#if item.data.total > 0 && item.data.available === item.data.total}<span class="all-available">All available</span>{:else}<span class="sub">{item.data.total ? 'Time unknown' : 'No machines'}</span>{/if}{/if}</div></div>
    {/each}
  </section>
  <div class="chart-tour-frame" class:tour-target={tourStep === 3}>
    {#if snapshot}
      <UsageChart machines={storedMachines} history={snapshot.history} dates={snapshot.dates} animationKey={dataRevision} />
    {:else}
      <section class="panel chart-loading" aria-label="Usage chart"><p>{error ? 'Usage history is unavailable.' : 'Loading usage history…'}</p></section>
    {/if}
  </div>
  <section class="panel machines" id="machines" aria-labelledby="machines-title" aria-busy={loading} tabindex="-1">
    <div class="machines-heading">
      <h2 id="machines-title">Machines</h2>
      <span class="machine-count">{filtered.length} machines</span>
      <div class="machine-sort">
        <span aria-hidden="true">Sort by</span>
        <SelectMenu bind:value={machineSort} options={machineSortOptions} label="Sort by" id="machine-sort-menu" />
      </div>
    </div>
    {#if snapshot && filtered.length}
      <div class="grid">
        {#each ['Washer', 'Dryer', 'Other'] as type}
          {@const machines = sortedMachines.filter(machine => type === 'Other' ? !['Washer', 'Dryer'].includes(machine.machineType) : machine.machineType === type)}
          {#if type !== 'Other' || machines.length}
            <div class="machine-column" class:other-machines={type === 'Other'} role="group" aria-label={type === 'Other' ? 'Other machines' : `${type}s`}>
              {#each machines as machine (machine.id)}
                {@const ranking = usageRank(machine, filtered)}
                <MachineCard {machine} {ranking} showDorm={dorm === 'All Dorms' && machine.dorm !== 'Unassigned'} animationKey={dataRevision} />
              {/each}
            </div>
          {/if}
        {/each}
      </div>
    {:else}<p class="empty">{loading ? 'Loading machines…' : snapshot ? 'No machines found for this dorm.' : 'Machine data is unavailable. Try refreshing.'}</p>{/if}
  </section>
  {/if}
  {#if problemVisible}
    <section class="panel" id="problem-report" aria-labelledby="problem-title" transition:cardTransition>
      <div class="info-card-heading"><h2 id="problem-title">Report a problem</h2><button class="info-card-close" aria-label="Close problem report" onclick={() => { problemVisible = false; void tick().then(() => document.getElementById('report-problem-button')?.focus()); }}>×</button></div>
      {#key dorm}<MachineReport {dorm} theme={resolvedTheme} debug={debugTurnstile} problem />{/key}
    </section>
  {/if}
  <footer><a href="#privacy" onclick={showPrivacy}>Privacy</a><a href="#why-no-laundry" onclick={showWhyNoLaundry}>Missing data?</a><button type="button" onclick={startTour}>Restart tour</button><button id="report-problem-button" type="button" aria-expanded={problemVisible} aria-controls="problem-report" onclick={showProblem}>Report a problem</button></footer>
</main>

<style>
  .brand-home { display: inline-flex; align-items: center; gap: 8px; color: inherit; text-decoration: none; white-space: nowrap; }
  .brand-logo { width: 1em; height: 1em; flex: none; transform: translateY(.02em); }
  @container brand (max-width: 125px) {
    .brand-logo { display: none; }
  }
  .privacy-card { scroll-margin-top: 16px; }
  .privacy-card p { margin: 8px 0 0; color: var(--muted); line-height: 1.6; }
  .privacy-card a { color: var(--ink); text-underline-offset: 3px; }
  .why-no-laundry { margin-top: 12px; }
  .why-no-laundry p { margin: 8px 0 0; color: var(--muted); line-height: 1.6; }
  .info-card-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .info-card-heading h2 { margin: 0; }
  .info-card-close { border: 0; padding: 0 4px; background: transparent; color: var(--muted); font: inherit; font-size: 24px; line-height: 1; cursor: pointer; }
  .info-card-close:hover { color: var(--ink); }
  footer { margin-top: -8px; padding: 0; text-align: center; font-size: 13px; }
  footer { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 16px; }
  footer a, footer button { display: inline-block; padding: 2px 0; border: 0; background: transparent; color: var(--muted); font: inherit; text-decoration: none; text-underline-offset: 3px; cursor: pointer; }
  footer a:hover, footer button:hover { text-decoration: underline; }
</style>
