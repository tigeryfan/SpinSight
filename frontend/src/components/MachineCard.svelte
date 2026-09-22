<script lang="ts">
  import type { Machine } from '../lib/data';
  let { machine, ranking, showDorm }: { machine: Machine; ranking: { rank: number; total: number } | null; showDorm: boolean } = $props();
  let expanded = $state(false);
  let dismissed = $state(false);
  let percentage = $derived(Math.round((machine.progress ?? (machine.status === 'Completed' || machine.estimatedComplete ? 1 : 0)) * 100));
  let status = $derived(machine.estimatedComplete ? 'Estimated complete' : machine.status === 'Running'
    ? machine.minutesLeft === null ? 'Running · time unknown' : `${machine.minutesLeft}m left`
    : machine.status === 'Completed' ? 'Awaiting unload' : machine.status);
</script>

<div class="machine" class:dry={machine.machineType === 'Dryer'} class:running={machine.status === 'Running' && !machine.estimatedComplete} class:completed={machine.status === 'Completed' || machine.estimatedComplete} class:expanded class:dismissed>
  <div class="progress-track" aria-hidden="true"><div class="progress-fill" style:width={`${percentage}%`}></div></div>
  <button class="machine-button" aria-expanded={expanded} aria-controls={`details-${machine.id}`} aria-label={`${machine.dorm}, ${machine.machineType} ${machine.machineName}, ${status}. ${expanded ? 'Hide' : 'Show'} details`}
    onclick={() => { expanded = !expanded; dismissed = !expanded; }}
    onpointerenter={() => dismissed = false} onfocus={() => dismissed = false}
    onkeydown={(event) => { if (event.key === 'Escape') { expanded = false; dismissed = true; } }}>
    <span class="name"><span>{machine.machineName}</span>{#if showDorm}<span class="dorm">{machine.dorm}</span>{/if}</span>
    <span class="status">{status}</span>
  </button>
  {#if machine.status === 'Running' && machine.progress !== null}
    <span class="sr-only" role="progressbar" aria-label={`${machine.machineName} estimate elapsed since last update`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={percentage} aria-valuetext={`${percentage}% of estimated remaining time elapsed since last update, ${status}`}></span>
  {/if}
  <div class="machine-details" id={`details-${machine.id}`}>
    <dl>
      <div><dt>Last Mon–Sun usage (est.)</dt><dd>{machine.usageHoursPastWeek === null ? 'No readings' : `${machine.usageHoursPastWeek.toFixed(1)}h`}</dd></div>
      <div><dt>Usage rank</dt><dd>{ranking ? `#${ranking.rank} of ${ranking.total}` : 'No readings'}</dd></div>
      {#if machine.estimatedCompletionTime && machine.status === 'Running'}<div><dt>Estimated finish</dt><dd>{new Date(machine.estimatedCompletionTime).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</dd></div>{/if}
      {#if machine.topOffAvailable}<div class="extra"><dt>Top off</dt><dd>Available</dd></div>{/if}
    </dl>
  </div>
</div>

<style>
  .machine { --machine-color: var(--wash); position: relative; min-width: 0; background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius-machine); transition: border-color .15s ease; }
  .machine.dry { --machine-color: var(--dry); }
  .machine:hover, .machine:focus-within { border-color: var(--muted); z-index: 2; }
  .progress-track { position: absolute; inset: 0; overflow: hidden; border-radius: max(0px, calc(var(--radius-machine) - 1px)); pointer-events: none; background: color-mix(in srgb, var(--machine-color) 5%, transparent); }
  .progress-fill { height: 100%; background: color-mix(in srgb, var(--machine-color) 28%, transparent); }
  .completed .progress-fill { opacity: .55; }
  .machine-button { display: flex; align-items: center; width: 100%; position: relative; gap: 8px; border: 0; border-radius: max(0px, calc(var(--radius-machine) - 1px)); padding: 15px 16px; background: transparent; color: var(--ink); text-align: left; }
  .name { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; flex: 1; min-width: 0; font-weight: 600; font-size: 13px; }
  .dorm { padding: 2px 7px; border-radius: 999px; background: color-mix(in srgb, var(--panel) 65%, transparent); color: var(--ink); font-size: 11px; font-weight: 400; white-space: nowrap; }
  .status { font-size: 12px; color: var(--muted); text-align: right; }
  .running .status { color: var(--ink); font-weight: 500; }
  .machine-details { visibility: hidden; opacity: 0; transform: translateY(4px); transition: opacity .15s ease, transform .15s ease, visibility .15s; position: absolute; bottom: calc(100% - 1px); right: 0; padding: 10px 12px; min-width: 216px; border-radius: var(--radius-control); background: var(--ink); color: var(--panel); box-shadow: var(--popover-shadow); font-size: 12px; z-index: 5; }
  .machine:not(.dismissed):hover .machine-details, .machine:not(.dismissed):focus-within .machine-details { visibility: visible; opacity: 1; transform: translateY(0); }
  .expanded .machine-details { visibility: visible; opacity: 1; transform: none; transition: none; position: relative; bottom: auto; padding: 0 16px 12px; background: transparent; color: var(--ink); box-shadow: none; min-width: 0; }
  dl { margin: 0; }
  dl div { display: flex; justify-content: space-between; gap: 16px; padding: 3px 0; }
  dt { opacity: .8; }
  dd { margin: 0; }
  .extra { border-top: 1px solid currentColor; margin-top: 5px; padding-top: 8px; }
  @media (hover: none) { .machine:not(.expanded) .machine-details { display: none; } }
  @media (prefers-reduced-motion: reduce) { .machine, .machine-details { transition: none; } }
</style>
