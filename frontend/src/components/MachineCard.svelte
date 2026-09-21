<script lang="ts">
  import type { Machine } from '../lib/data';
  let { machine, rank, total, showDorm }: { machine: Machine; rank: number; total: number; showDorm: boolean } = $props();
  let expanded = $state(false);
  let dismissed = $state(false);
  let percentage = $derived(Math.round(machine.progress * 100));
  let status = $derived(machine.status === 'Running' ? `${machine.minutesLeft}m left` : machine.status === 'Completed' ? 'Awaiting unload' : 'Available');
</script>

<div class="machine" class:dry={machine.machineType === 'Dryer'} class:running={machine.status === 'Running'} class:completed={machine.status === 'Completed'} class:expanded class:dismissed>
  <div class="progress-track" aria-hidden="true"><div class="progress-fill" style:width={`${percentage}%`}></div></div>
  <button class="machine-button" aria-expanded={expanded} aria-controls={`details-${machine.id}`} aria-label={`${machine.dorm}, ${machine.machineType} ${machine.machineName}, ${status}. ${expanded ? 'Hide' : 'Show'} details`}
    onclick={() => { expanded = !expanded; dismissed = !expanded; }}
    onpointerenter={() => dismissed = false} onfocus={() => dismissed = false}
    onkeydown={(event) => { if (event.key === 'Escape') { expanded = false; dismissed = true; } }}>
    <span class="pip" aria-hidden="true"></span>
    <span class="name">{machine.machineName}{#if showDorm}<span class="dorm">{machine.dorm}</span>{/if}</span>
    <span class="status">{status}</span>
  </button>
  {#if machine.status === 'Running'}
    <span class="sr-only" role="progressbar" aria-label={`${machine.machineName} cycle progress`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={percentage} aria-valuetext={`${percentage}% complete, ${status}`}></span>
  {/if}
  <div class="machine-details" id={`details-${machine.id}`}>
    <dl>
      <div><dt>Last Mon–Sun usage</dt><dd>{machine.usageHoursPastWeek.toFixed(1)}h</dd></div>
      <div><dt>Usage rank</dt><dd>#{rank} of {total}</dd></div>
      {#if machine.topOffAvailable}<div class="extra"><dt>Top off</dt><dd>Available</dd></div>{/if}
    </dl>
  </div>
</div>

<style>
  .machine { --machine-color: var(--wash); position: relative; min-width: 0; background: var(--panel); border: 1px solid var(--line); border-radius: 14px; }
  .machine.dry { --machine-color: var(--dry); }
  .machine:hover, .machine:focus-within { border-color: var(--muted); z-index: 2; }
  .progress-track { position: absolute; inset: 0; overflow: hidden; border-radius: inherit; pointer-events: none; background: color-mix(in srgb, var(--machine-color) 5%, transparent); }
  .progress-fill { height: 100%; background: color-mix(in srgb, var(--machine-color) 28%, transparent); }
  .completed .progress-fill { opacity: .55; }
  .machine-button { display: flex; align-items: center; width: 100%; position: relative; gap: 8px; border: 0; border-radius: inherit; padding: 15px 16px; background: transparent; color: var(--ink); text-align: left; }
  .pip { width: 10px; height: 10px; border-radius: 50%; background: var(--done); flex: none; }
  .running .pip { background: var(--running); }
  .completed .pip { background: var(--warn); }
  .name { flex: 1; min-width: 0; font-weight: 600; font-size: 13px; }
  .dorm { display: block; color: var(--muted); font-size: 11px; font-weight: 400; margin-top: 1px; }
  .status { font-size: 12px; color: var(--muted); text-align: right; }
  .running .status { color: var(--ink); font-weight: 500; }
  .machine-details { display: none; position: absolute; bottom: calc(100% - 1px); right: 0; padding: 10px 12px; min-width: 216px; border-radius: 8px; background: var(--ink); color: var(--panel); box-shadow: var(--popover-shadow); font-size: 12px; z-index: 5; }
  .machine:not(.dismissed):hover .machine-details, .machine:not(.dismissed):focus-within .machine-details { display: block; }
  .expanded .machine-details { display: block; position: relative; bottom: auto; padding: 0 16px 12px; background: transparent; color: var(--ink); box-shadow: none; min-width: 0; }
  dl { margin: 0; }
  dl div { display: flex; justify-content: space-between; gap: 16px; padding: 3px 0; }
  dt { opacity: .8; }
  dd { margin: 0; }
  .extra { border-top: 1px solid currentColor; margin-top: 5px; padding-top: 8px; }
  @media (hover: none) { .machine:not(.expanded) .machine-details { display: none; } }
</style>
