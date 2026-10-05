<script lang="ts">
  import { onMount } from 'svelte';
  import type { Machine } from '../lib/data';

  type SummaryView = { available: number; total: number; next?: { machineName: string; minutesLeft: number } };
  type MachinePatch = { status?: string; minutesLeft?: number | null };
  type Patch = {
    washersAvailable?: number;
    washersTotal?: number;
    dryersAvailable?: number;
    dryersTotal?: number;
    nextWasherMinutes?: number;
    nextDryerMinutes?: number;
    machineOverrides?: Record<string, MachinePatch>;
  };

  let {
    washers,
    dryers,
    machines,
    dorm,
    onPatch,
    onReset,
  }: {
    washers: SummaryView;
    dryers: SummaryView;
    machines: Machine[];
    dorm: string;
    onPatch: (patch: Patch) => void;
    onReset: () => void;
  } = $props();

  let open = $state(false);
  let zoneHovered = $state(false);
  let alwaysVisible = $state(false);

  let statInputs = $state({
    washersAvailable: 0,
    washersTotal: 0,
    dryersAvailable: 0,
    dryersTotal: 0,
    nextWasherMinutes: 0,
    nextDryerMinutes: 0,
  });
  let machineDrafts = $state<Record<string, { status: string; minutesLeft: number }>>({});

  // Keep draft inputs in sync with the live dashboard whenever the panel is closed
  // or new machines appear. Closing the panel re-applies fresh values from the live
  // data so the user always sees what would render without their overrides.
  $effect(() => {
    statInputs = {
      washersAvailable: washers.available,
      washersTotal: washers.total,
      dryersAvailable: dryers.available,
      dryersTotal: dryers.total,
      nextWasherMinutes: washers.next?.minutesLeft ?? 0,
      nextDryerMinutes: dryers.next?.minutesLeft ?? 0,
    };
    for (const machine of machines) {
      if (!(machine.id in machineDrafts)) {
        machineDrafts[machine.id] = { status: machine.status, minutesLeft: machine.minutesLeft ?? 0 };
      }
    }
  });

  function commitStat(field: keyof typeof statInputs) {
    return (event: Event) => {
      const value = Number((event.currentTarget as HTMLInputElement).value);
      const next = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
      statInputs[field] = next;
      onPatch({ [field]: next } as Patch);
    };
  }

  function commitAll() {
    const patch: Patch = {};
    for (const key of Object.keys(statInputs) as Array<keyof typeof statInputs>) {
      (patch as Record<string, number>)[key] = statInputs[key];
    }
    onPatch(patch);
  }

  function commitMachine(id: string) {
    const draft = machineDrafts[id];
    if (!draft) return;
    const patch: Record<string, MachinePatch> = { [id]: {} };
    const base = machines.find(machine => machine.id === id);
    if (base && draft.status !== base.status) patch[id].status = draft.status;
    if (base && draft.minutesLeft !== (base.minutesLeft ?? 0)) patch[id].minutesLeft = draft.minutesLeft;
    onPatch({ machineOverrides: patch });
  }

  function bulkStatus(status: string) {
    const drafts: typeof machineDrafts = {};
    for (const machine of machines) {
      drafts[machine.id] = { status, minutesLeft: status === 'Running' ? Math.max(1, machineDrafts[machine.id]?.minutesLeft ?? 30) : 0 };
    }
    machineDrafts = drafts;
    const patch: Record<string, MachinePatch> = {};
    for (const machine of machines) patch[machine.id] = { status, minutesLeft: drafts[machine.id].minutesLeft };
    onPatch({ machineOverrides: patch });
  }

  function clearAll() {
    for (const id of Object.keys(machineDrafts)) delete machineDrafts[id];
    onReset();
  }

  onMount(() => {
    alwaysVisible = !window.matchMedia('(hover: hover)').matches;
    const onMove = (event: MouseEvent) => {
      zoneHovered = event.clientX < 96 && event.clientY > window.innerHeight - 96;
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  });

  const buttonVisible = $derived(open || zoneHovered || alwaysVisible);
  const sortedMachines = $derived([...machines].sort((a, b) => a.machineName.localeCompare(b.machineName, undefined, { numeric: true })));
</script>

<div class="trigger" class:active={open} aria-hidden="true"></div>

{#if buttonVisible}
  <button class="debug-toggle" type="button" aria-label={open ? 'Close debug panel' : 'Open debug panel'} aria-expanded={open}
    onclick={() => { if (!open) open = true; }}
    oncontextmenu={(event) => { event.preventDefault(); open = !open; }}>
    <span class="icon" aria-hidden="true">
      {#if open}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      {:else}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>
        </svg>
      {/if}
    </span>
  </button>
{/if}

{#if open}
  <div class="debug-panel" role="dialog" aria-modal="false" aria-label="Debug panel">
    <header>
      <div class="title">
        <h2>Debug</h2>
        <span class="dorm">{dorm}</span>
      </div>
      <button type="button" class="ghost" onclick={() => { open = false; }} aria-label="Close">×</button>
    </header>

    <section class="block">
      <h3>Stats</h3>
      <div class="grid">
        <label class="stat">
          <span class="label">Washers available</span>
          <div class="input-row">
            <input type="number" min="0" value={statInputs.washersAvailable} onchange={commitStat('washersAvailable')} />
            <span class="dim">/ {statInputs.washersTotal}</span>
          </div>
        </label>
        <label class="stat">
          <span class="label">Dryers available</span>
          <div class="input-row">
            <input type="number" min="0" value={statInputs.dryersAvailable} onchange={commitStat('dryersAvailable')} />
            <span class="dim">/ {statInputs.dryersTotal}</span>
          </div>
        </label>
        <label class="stat">
          <span class="label">Washers total</span>
          <input type="number" min="0" value={statInputs.washersTotal} onchange={commitStat('washersTotal')} />
        </label>
        <label class="stat">
          <span class="label">Dryers total</span>
          <input type="number" min="0" value={statInputs.dryersTotal} onchange={commitStat('dryersTotal')} />
        </label>
        <label class="stat wide">
          <span class="label">Next washer</span>
          <div class="input-row">
            <span class="machine-name">{washers.next?.machineName ?? '—'}</span>
            <input type="number" min="0" value={statInputs.nextWasherMinutes} onchange={commitStat('nextWasherMinutes')} />
            <span class="dim">m</span>
          </div>
        </label>
        <label class="stat wide">
          <span class="label">Next dryer</span>
          <div class="input-row">
            <span class="machine-name">{dryers.next?.machineName ?? '—'}</span>
            <input type="number" min="0" value={statInputs.nextDryerMinutes} onchange={commitStat('nextDryerMinutes')} />
            <span class="dim">m</span>
          </div>
        </label>
      </div>
    </section>

    <section class="block">
      <h3>Bulk</h3>
      <div class="bulk">
        <button type="button" class="chip" onclick={() => bulkStatus('Available')}>All available</button>
        <button type="button" class="chip" onclick={() => bulkStatus('Running')}>All running</button>
        <button type="button" class="chip" onclick={() => bulkStatus('Completed')}>All completed</button>
      </div>
    </section>

    <section class="block machines-block" hidden>
      <h3>Machines</h3>
      <div class="machine-list">
        {#each sortedMachines as machine (machine.id)}
          {@const draft = machineDrafts[machine.id] ?? { status: machine.status, minutesLeft: machine.minutesLeft ?? 0 }}
          <div class="machine-row">
            <span class="machine-tag" data-type={machine.machineType}>{machine.machineName}</span>
            <select value={draft.status} onchange={(event) => {
              const status = (event.currentTarget as HTMLSelectElement).value;
              machineDrafts[machine.id] = { ...draft, status };
              commitMachine(machine.id);
            }}>
              <option value="Available">Available</option>
              <option value="Running">Running</option>
              <option value="Completed">Completed</option>
            </select>
            <input type="number" min="0" value={draft.minutesLeft} disabled={draft.status !== 'Running'} onchange={(event) => {
              const minutesLeft = Math.max(0, Number((event.currentTarget as HTMLInputElement).value) || 0);
              machineDrafts[machine.id] = { ...draft, minutesLeft };
              commitMachine(machine.id);
            }} />
          </div>
        {/each}
      </div>
    </section>

    <footer>
      <button type="button" class="reset" onclick={clearAll}>Reset overrides</button>
    </footer>
  </div>
{/if}

<style>
  .trigger {
    position: fixed; left: 0; bottom: 0; width: 96px; height: 96px; z-index: 60;
  }
  .trigger.active { width: 360px; height: 100%; pointer-events: none; }
  .debug-toggle {
    position: fixed; left: 24px; bottom: 24px; z-index: 70;
    width: 36px; height: 36px; padding: 0; border: 1px solid var(--line); border-radius: 50%;
    background: var(--panel); color: var(--ink); box-shadow: var(--popover-shadow);
    display: grid; place-items: center;
    transition: opacity .18s ease, transform .18s ease;
    animation: debug-pop .18s ease-out;
  }
  .debug-toggle:hover { transform: translateY(-1px); }
  .debug-toggle .icon { width: 18px; height: 18px; display: grid; place-items: center; }
  .debug-toggle svg { width: 18px; height: 18px; }
  @keyframes debug-pop {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .debug-panel {
    position: fixed; left: 24px; bottom: 24px; z-index: 65;
    width: 360px; max-width: calc(100vw - 48px); max-height: 80vh;
    display: flex; flex-direction: column;
    background: var(--panel); color: var(--ink); border-radius: var(--radius-panel);
    border: 1px solid var(--line); box-shadow: var(--popover-shadow);
    animation: debug-slide .22s cubic-bezier(.2, .8, .2, 1);
    overflow: hidden;
  }
  @keyframes debug-slide {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px; border-bottom: 1px solid var(--line);
  }
  .title { display: flex; align-items: baseline; gap: 10px; }
  h2 { font-size: 14px; font-weight: 600; letter-spacing: -.01em; }
  .dorm { font-size: 12px; color: var(--muted); }
  .ghost {
    border: 0; background: transparent; color: var(--muted);
    width: 26px; height: 26px; padding: 0; border-radius: 8px; font-size: 18px; line-height: 1;
  }
  .ghost:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 6%, transparent); }

  .block { padding: 14px 16px; border-bottom: 1px solid var(--line); }
  .block:last-of-type { border-bottom: 0; }
  h3 {
    margin: 0 0 10px; font-size: 11px; font-weight: 600; letter-spacing: .04em;
    text-transform: uppercase; color: var(--muted);
  }

  .grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px 12px;
  }
  .stat { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .stat.wide { grid-column: 1 / -1; }
  .stat .label { font-size: 11px; color: var(--muted); letter-spacing: .02em; white-space: nowrap; }
  .stat input {
    height: 32px; padding: 0 10px; min-width: 0;
    border: 1px solid var(--line); border-radius: 8px;
    background: var(--bg); color: var(--ink); font-size: 13px;
    font-variant-numeric: tabular-nums;
    transition: border-color .15s ease, box-shadow .15s ease;
  }
  .stat input:focus {
    outline: 0; border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
  }
  .input-row { display: flex; align-items: center; gap: 6px; }
  .input-row .dim { font-size: 12px; color: var(--muted); }
  .input-row input { flex: 1; }
  .machine-name {
    flex: none; padding: 2px 8px; border-radius: 999px;
    background: color-mix(in srgb, var(--accent) 10%, transparent); color: var(--ink);
    font-size: 11px; font-weight: 600; letter-spacing: .02em;
  }

  .bulk { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    height: 30px; padding: 0 12px; border: 1px solid var(--line); border-radius: 999px;
    background: var(--panel); color: var(--ink); font-size: 12px;
    transition: background .15s ease, border-color .15s ease;
  }
  .chip:hover { border-color: color-mix(in srgb, var(--ink) 18%, transparent); }

  .machines-block { padding-bottom: 6px; }
  .machine-list { max-height: 36vh; overflow-y: auto; margin: 0 -4px; padding: 0 4px; }
  .machine-row {
    display: grid; grid-template-columns: 56px 1fr 70px; align-items: center; gap: 8px;
    padding: 6px 0;
  }
  .machine-tag {
    display: inline-flex; align-items: center; justify-content: center;
    height: 24px; padding: 0 8px; border-radius: 999px;
    background: color-mix(in srgb, var(--wash) 12%, transparent);
    color: var(--ink); font-size: 11px; font-weight: 600;
  }
  .machine-tag[data-type='Dryer'] { background: color-mix(in srgb, var(--dry) 14%, transparent); }
  .machine-list select, .machine-list input {
    height: 28px; padding: 0 8px;
    border: 1px solid var(--line); border-radius: 7px;
    background: var(--bg); color: var(--ink); font-size: 12px;
    font-variant-numeric: tabular-nums;
    transition: border-color .15s ease, opacity .15s ease;
  }
  .machine-list input:disabled { opacity: .45; cursor: not-allowed; }
  .machine-list select:focus, .machine-list input:focus {
    outline: 0; border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
  }
  .machine-list select { width: 100%; min-width: 0; }
  .machine-list input { width: 100%; }

  footer {
    display: flex; justify-content: flex-end;
    padding: 10px 16px 14px; border-top: 1px solid var(--line);
    background: color-mix(in srgb, var(--bg) 60%, transparent);
  }
  .reset {
    height: 30px; padding: 0 12px; border: 1px solid transparent; border-radius: 8px;
    background: transparent; color: var(--muted); font-size: 12px;
    text-decoration: underline; text-underline-offset: 3px;
  }
  .reset:hover { color: var(--ink); }

  @media (max-width: 480px) {
    .debug-panel { left: 12px; right: 12px; bottom: 12px; width: auto; }
    .debug-toggle { left: 12px; bottom: 12px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .debug-toggle, .debug-panel { animation: none; }
  }
</style>