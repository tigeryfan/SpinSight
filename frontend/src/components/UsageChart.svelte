<script lang="ts">
  import { dailyUsage, weeklyUsage, days, dayNames, lastFullWeek, type Machine } from '../lib/data';
  let { machines }: { machines: Machine[] } = $props();
  let view = $state(-1);
  let width = $state(700);
  let active = $state<number | null>(null);
  let showTable = $state(false);
  let dragging = $state(false);
  let tabs: HTMLDivElement;
  const dates = lastFullWeek();
  const formatDate = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  let points = $derived(view === -1 ? weeklyUsage(machines) : dailyUsage(machines, view));
  let capacity = $derived(Math.max(1, machines.filter(m => m.machineType === 'Washer').length, machines.filter(m => m.machineType === 'Dryer').length));
  let chartWidth = $derived(Math.max(width, 240));
  const height = 260;
  const left = 32;
  const top = 16;
  const bottom = 226;
  let plotWidth = $derived(chartWidth - left - 16);
  const x = (i: number) => left + i / Math.max(1, points.length - 1) * plotWidth;
  const y = (value: number) => bottom - (value / capacity) * (bottom - top);
  const line = (key: 'washers' | 'dryers') => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p[key])}`).join(' ');
  const area = (key: 'washers' | 'dryers') => `${line(key)} L${x(points.length - 1)},${bottom} L${left},${bottom} Z`;
  let ticks = $derived(Array.from({ length: Math.min(capacity, 4) + 1 }, (_, i) => Math.round(i * capacity / Math.min(capacity, 4))));
  let title = $derived(view === -1 ? 'Last full week' : `${dayNames[view]}, ${formatDate(dates[view])}`);
  let selected = $derived(active === null ? null : points[active]);

  function select(index: number, focus = false) {
    view = index; active = null;
    if (focus) tabs.querySelectorAll('button')[index + 1]?.focus();
  }
  function tabKey(event: KeyboardEvent) {
    let index: number | undefined;
    if (event.key === 'ArrowRight') index = (view + 2) % 8 - 1;
    if (event.key === 'ArrowLeft') index = (view + 8) % 8 - 1;
    if (event.key === 'Home') index = -1;
    if (event.key === 'End') index = 6;
    if (index !== undefined) { event.preventDefault(); select(index, true); }
  }
  function scrub(event: PointerEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    active = Math.max(0, Math.min(points.length - 1, Math.round((event.clientX - rect.left - left) / plotWidth * (points.length - 1))));
  }
  function drag(event: PointerEvent) {
    if (!dragging) return;
    const buttons = [...tabs.querySelectorAll('button')];
    const index = buttons.findIndex(button => { const rect = button.getBoundingClientRect(); return event.clientX >= rect.left && event.clientX <= rect.right; });
    if (index !== -1 && index - 1 !== view) select(index - 1);
  }
</script>

<svelte:window onpointerup={() => dragging = false} onpointercancel={() => dragging = false} />
<section class="panel chart-panel" aria-label="Laundry usage history">
  <div class="chart-header">
    <div class="range" role="tablist" aria-label="Usage period" bind:this={tabs} onkeydown={tabKey} onpointermove={drag}>
      <span class="range-thumb" style:transform={`translateX(${(view + 1) * 100}%)`} aria-hidden="true"></span>
      {#each ['Week', ...days] as label, index}
        <button id={`period-${index}`} role="tab" aria-selected={view === index - 1} aria-controls="usage-panel" tabindex={view === index - 1 ? 0 : -1}
          onclick={() => select(index - 1)} onpointerdown={(event) => { if (event.button === 0) { dragging = true; select(index - 1); } }}>{label}</button>
      {/each}
    </div>
    <div class="legend"><span><i class="wash"></i>Washers</span><span><i class="dry"></i>Dryers</span></div>
  </div>
  <div id="usage-panel" role="tabpanel" aria-labelledby={`period-${view + 1}`}>
    <div class="chart-caption"><span>{title}{#if view === -1} · {formatDate(dates[0])}–{formatDate(dates[6])}{/if}</span><span>{view === -1 ? 'Daily average in use' : 'Machines in use'}</span></div>
    <div class="chart-wrap" bind:clientWidth={width}>
      <svg viewBox={`0 0 ${chartWidth} ${height}`} role="img" aria-label={`${title}: washers and dryers in use. Use the chart slider or view data for values.`}>
        <defs>
          <linearGradient id="wash-area" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--wash)" stop-opacity=".18" /><stop offset="1" stop-color="var(--wash)" stop-opacity="0" /></linearGradient>
          <linearGradient id="dry-area" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--dry)" stop-opacity=".14" /><stop offset="1" stop-color="var(--dry)" stop-opacity="0" /></linearGradient>
        </defs>
        {#each ticks as value}
          <line class="grid-line" x1={left} x2={chartWidth - 16} y1={y(value)} y2={y(value)} />
          <text class="axis" x={left - 10} y={y(value) + 4} text-anchor="end">{value}</text>
        {/each}
        <path d={area('washers')} fill="url(#wash-area)" /><path d={area('dryers')} fill="url(#dry-area)" />
        <path class="series washers" d={line('washers')} /><path class="series dryers" d={line('dryers')} />
        {#each points as point, index}
          {#if view === -1 || index === 0 || index === 23 || index % (width < 450 ? 6 : 3) === 0 && index < 22}
            <text class="axis" x={x(index)} y={height - 9} text-anchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}>{point.label}</text>
          {/if}
        {/each}
        {#if active !== null && selected}
          <line class="hover-line" x1={x(active)} x2={x(active)} y1={top} y2={bottom} />
          <circle cx={x(active)} cy={y(selected.washers)} r="4" fill="var(--wash)" stroke="var(--panel)" stroke-width="2" />
          <circle cx={x(active)} cy={y(selected.dryers)} r="4" fill="var(--dry)" stroke="var(--panel)" stroke-width="2" />
        {/if}
      </svg>
      <input class="chart-input" type="range" min="0" max={points.length - 1} step="1" value={active ?? 0} aria-label="Explore chart values"
        aria-valuetext={selected ? `${selected.label}, ${selected.washers} washers, ${selected.dryers} dryers` : `${points[0].label}, ${points[0].washers} washers, ${points[0].dryers} dryers`}
        oninput={(event) => active = Number(event.currentTarget.value)} onpointermove={scrub} onpointerdown={scrub}
        onpointerleave={(event) => { if (document.activeElement !== event.currentTarget) active = null; }}
        onfocus={() => active = active ?? 0} onblur={() => active = null} onkeydown={(event) => { if (event.key === 'Escape') active = null; }} />
      {#if active !== null && selected}
        <div class="chart-tooltip" style:left={`${Math.max(0, Math.min(chartWidth - 154, x(active) - 72))}px`}>
          <strong>{selected.label}</strong><span><i class="wash"></i>Washers <b>{selected.washers}</b></span><span><i class="dry"></i>Dryers <b>{selected.dryers}</b></span>
        </div>
      {/if}
    </div>
    <div class="chart-footer"><span>Illustrative history</span><button class="text-button" aria-expanded={showTable} aria-controls="usage-data" onclick={() => showTable = !showTable}>{showTable ? 'Hide data' : 'View data'}</button></div>
    {#if showTable}
      <div id="usage-data" class="table-wrap"><table><caption>{title} · {view === -1 ? 'Daily average machines in use' : 'Machines in use'}</caption><thead><tr><th scope="col">{view === -1 ? 'Day' : 'Hour'}</th><th scope="col">Washers</th><th scope="col">Dryers</th></tr></thead><tbody>{#each points as point}<tr><th scope="row">{point.label}</th><td>{point.washers}</td><td>{point.dryers}</td></tr>{/each}</tbody></table></div>
    {/if}
  </div>
</section>

<style>
  .chart-panel { padding: 20px 22px 14px; border-radius: 14px; }
  .chart-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px 24px; margin-bottom: 20px; }
  .range { position: relative; display: grid; grid-template-columns: repeat(8, 1fr); padding: 4px; border: 1px solid var(--line); border-radius: 8px; user-select: none; touch-action: pan-y; }
  .range button { z-index: 1; padding: 7px 12px; border: 0; background: transparent; border-radius: 6px; color: var(--ink); font-size: 13px; cursor: grab; }
  .range button:active { cursor: grabbing; }
  .range button[aria-selected='true'] { color: var(--selected-ink); }
  .range-thumb { position: absolute; left: 4px; top: 4px; bottom: 4px; width: calc((100% - 8px) / 8); border-radius: 6px; background: var(--selected); transition: transform .22s cubic-bezier(.16, 1, .3, 1); }
  .legend { display: flex; gap: 16px; font-size: 12px; color: var(--muted); }
  .legend span { display: flex; align-items: center; gap: 7px; }
  i { display: inline-block; width: 18px; height: 3px; border-radius: 3px; flex: none; }
  i.wash { background: var(--wash); } i.dry { background: var(--dry); }
  .chart-caption { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 4px 16px; font-size: 11px; color: var(--muted); margin-bottom: 8px; }
  .chart-wrap { position: relative; min-width: 0; }
  svg { display: block; width: 100%; height: 260px; overflow: visible; }
  .grid-line { stroke: var(--line); stroke-width: 1; stroke-dasharray: 2 5; }
  .axis { fill: var(--muted); font-size: 11px; font-family: inherit; }
  .series { fill: none; stroke-width: 2.25; stroke-linecap: round; stroke-linejoin: round; }
  .washers { stroke: var(--wash); } .dryers { stroke: var(--dry); }
  .hover-line { stroke: var(--muted); stroke-dasharray: 3 4; }
  .chart-input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: crosshair; }
  .chart-wrap:has(.chart-input:focus-visible) { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 4px; }
  .chart-tooltip { position: absolute; top: 24px; width: 154px; padding: 10px 12px; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; box-shadow: var(--popover-shadow); font-size: 12px; pointer-events: none; }
  .chart-tooltip strong { display: block; margin-bottom: 6px; }
  .chart-tooltip span { display: flex; align-items: center; gap: 7px; color: var(--muted); padding: 2px 0; }
  .chart-tooltip i { width: 8px; height: 8px; border-radius: 50%; }
  .chart-tooltip b { margin-left: auto; color: var(--ink); }
  .chart-footer { display: flex; justify-content: space-between; align-items: center; color: var(--muted); font-size: 11px; }
  .table-wrap { margin-top: 12px; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: right; }
  caption { text-align: left; padding-bottom: 8px; color: var(--muted); }
  th, td { padding: 8px; border-bottom: 1px solid var(--line); }
  th:first-child { text-align: left; }
  @media (max-width: 600px) {
    .chart-panel { padding: 16px 12px 10px; }
    .range { width: 100%; }
    .range button { padding: 10px 0; font-size: 11px; }
    .chart-header { gap: 12px; margin-bottom: 16px; }
  }
  @media (prefers-reduced-motion: reduce) { .range-thumb { transition: none; } }
</style>
