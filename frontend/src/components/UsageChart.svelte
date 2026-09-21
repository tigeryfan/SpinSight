<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { dailyUsage, weeklyUsage, days, dayNames, lastFullWeek, type Machine } from '../lib/data';
  let { machines }: { machines: Machine[] } = $props();
  let view = $state(-1);
  let width = $state(700);
  let active = $state<number | null>(null);
  let dragState: { pointerId: number; startX: number; startLeft: number; buttonWidth: number } | null = null;
  let dragMoved = false;
  let thumbOffset = $state<number | null>(null);
  let thumbAnimated = $state(true);
  let hoverIndex = $state(0);
  let glide = $state(false);
  let tooltipWidth = $state(154);
  let tooltipHeight = $state(92);
  let chartData: SVGGElement;
  let chartAnimation: Animation | undefined;
  let tabs: HTMLDivElement;
  const dates = lastFullWeek();
  const formatDate = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  let points = $derived(view === -1 ? weeklyUsage(machines) : dailyUsage(machines, view));
  let capacity = $derived(Math.max(1, machines.filter(m => m.machineType === 'Washer').length, machines.filter(m => m.machineType === 'Dryer').length));
  let chartWidth = $derived(Math.max(width, 240));
  const height = 260;
  const left = 32;
  const top = 28;
  const bottom = 226;
  let plotWidth = $derived(chartWidth - left - 16);
  const x = (i: number) => left + i / Math.max(1, points.length - 1) * plotWidth;
  const y = (value: number) => bottom - (value / capacity) * (bottom - top);
  const line = (key: 'washers' | 'dryers') => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p[key])}`).join(' ');
  const area = (key: 'washers' | 'dryers') => `${line(key)} L${x(points.length - 1)},${bottom} L${left},${bottom} Z`;
  let ticks = $derived(Array.from({ length: Math.min(capacity, 4) + 1 }, (_, i) => Math.round(i * capacity / Math.min(capacity, 4))));
  let title = $derived(view === -1 ? 'Last full week' : `${dayNames[view]}, ${formatDate(dates[view])}`);
  let selected = $derived(points[Math.min(hoverIndex, points.length - 1)]);
  let hoverX = $derived(x(Math.min(hoverIndex, points.length - 1)));
  let washerY = $derived(y(selected.washers));
  let dryerY = $derived(y(selected.dryers));
  let midY = $derived((washerY + dryerY) / 2);
  let mergeGuides = $derived(Math.abs(washerY - dryerY) <= 12);
  let tooltipX = $derived(Math.max(8, Math.min(chartWidth - tooltipWidth - 8,
    hoverX + 12 + tooltipWidth > chartWidth - 8 ? hoverX - tooltipWidth - 12 : hoverX + 12)));
  let tooltipY = $derived(Math.max(8, Math.min(height - tooltipHeight - 8,
    midY + 12 + tooltipHeight > height - 8 ? midY - tooltipHeight - 12 : midY + 12)));

  function select(index: number, focus = false, animate = true) {
    if (index === view) return;
    chartAnimation?.cancel();
    view = index; active = null; hoverIndex = 0;
    thumbAnimated = animate;
    if (animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      void tick().then(() => {
        if (view === index && !dragMoved) chartAnimation = chartData.animate(
          [{ opacity: 0.5 }, { opacity: 1 }],
          { duration: 180, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
        );
      });
    }
    if (focus) tabs.querySelectorAll('button')[index + 1]?.focus();
  }
  onDestroy(() => chartAnimation?.cancel());
  function tabKey(event: KeyboardEvent) {
    let index: number | undefined;
    if (event.key === 'ArrowRight') index = (view + 2) % 8 - 1;
    if (event.key === 'ArrowLeft') index = (view + 8) % 8 - 1;
    if (event.key === 'Home') index = -1;
    if (event.key === 'End') index = 6;
    if (index !== undefined) { event.preventDefault(); select(index, true, false); }
  }
  function showPoint(index: number) {
    glide = active !== null;
    hoverIndex = index;
    active = index;
  }
  function scrub(event: PointerEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    showPoint(Math.max(0, Math.min(points.length - 1, Math.round((event.clientX - rect.left - left) / plotWidth * (points.length - 1)))));
  }
  function startDrag(event: PointerEvent, index: number) {
    if (event.button !== 0) return;
    dragMoved = false;
    thumbOffset = null;
    select(index);
    const button = event.currentTarget as HTMLButtonElement;
    const first = tabs.querySelector('button')!;
    dragState = { pointerId: event.pointerId, startX: event.clientX, startLeft: button.offsetLeft - first.offsetLeft, buttonWidth: button.getBoundingClientRect().width };
  }
  function drag(event: PointerEvent) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const dx = event.clientX - dragState.startX;
    if (!dragMoved && Math.abs(dx) > 3) {
      dragMoved = true;
      chartAnimation?.cancel();
      tabs.setPointerCapture(event.pointerId);
      thumbAnimated = false;
    }
    if (!dragMoved) return;
    const buttons = tabs.querySelectorAll('button');
    const maxOffset = buttons[buttons.length - 1].offsetLeft - buttons[0].offsetLeft;
    thumbOffset = Math.max(0, Math.min(maxOffset, dragState.startLeft + dx));
    select(Math.round(thumbOffset / dragState.buttonWidth) - 1, false, false);
  }
  function endDrag(event: PointerEvent) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    dragState = null;
    if (tabs.hasPointerCapture(event.pointerId)) tabs.releasePointerCapture(event.pointerId);
    if (dragMoved) { thumbAnimated = false; thumbOffset = null; }
  }
</script>

<svelte:window onpointerup={endDrag} onpointercancel={endDrag} />
<section class="panel chart-panel" aria-label="Laundry usage history">
  <div class="chart-header">
    <div class="range" role="tablist" tabindex="-1" aria-label="Usage period" bind:this={tabs} onkeydown={tabKey} onpointermove={drag}
      onpointerleave={() => { if (!dragMoved) dragState = null; }}>
      <span class="range-thumb" class:direct={!thumbAnimated} style:transform={thumbOffset === null ? `translateX(${(view + 1) * 100}%)` : `translateX(${thumbOffset}px)`} aria-hidden="true"></span>
      {#each ['Week', ...days] as label, index}
        <button id={`period-${index}`} role="tab" aria-selected={view === index - 1} aria-controls="usage-panel" tabindex={view === index - 1 ? 0 : -1}
          onclick={(event) => { if (event.detail === 0 || !dragMoved) select(index - 1, false, event.detail !== 0); dragMoved = false; }}
          onpointerdown={(event) => startDrag(event, index - 1)}>{label}</button>
      {/each}
    </div>
  </div>
  <div id="usage-panel" role="tabpanel" aria-labelledby={`period-${view + 1}`}>
    <div class="chart-wrap" bind:clientWidth={width}>
      <div class="legend"><span><i class="wash"></i>Washers</span><span><i class="dry"></i>Dryers</span></div>
      <svg viewBox={`0 0 ${chartWidth} ${height}`} role="img" aria-label={`${title}${view === -1 ? `, ${formatDate(dates[0])}–${formatDate(dates[6])}, daily average` : ''}: washers and dryers in use. Use the chart slider to explore values.`}>
        <defs>
          <linearGradient id="wash-area" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--wash)" stop-opacity=".18" /><stop offset="1" stop-color="var(--wash)" stop-opacity="0" /></linearGradient>
          <linearGradient id="dry-area" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--dry)" stop-opacity=".14" /><stop offset="1" stop-color="var(--dry)" stop-opacity="0" /></linearGradient>
        </defs>
        {#each ticks as value}
          <line class="grid-line" x1={left} x2={chartWidth - 16} y1={y(value)} y2={y(value)} />
          <text class="axis" x={left - 10} y={y(value) + 4} text-anchor="end">{value}</text>
        {/each}
        <g class="chart-data" bind:this={chartData}>
          <path d={area('washers')} fill="url(#wash-area)" /><path d={area('dryers')} fill="url(#dry-area)" />
          <path class="series washers" d={line('washers')} /><path class="series dryers" d={line('dryers')} />
        </g>
        {#each points as point, index}
          {#if view === -1 || index === 0 || index === 23 || index % (width < 450 ? 6 : 3) === 0 && index < 22}
            <text class="axis" x={x(index)} y={height - 9} text-anchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}>{point.label}</text>
          {/if}
        {/each}
        <g class="hover-overlay" class:visible={active !== null} class:direct={active !== null && !glide} aria-hidden="true">
          <line class="hover-line hover-line-x" x1="0" x2="0" y1={top} y2={bottom} style:transform={`translateX(${hoverX}px)`} />
          <line class="hover-line hover-line-y-w" x1={left} x2={chartWidth - 16} y1="0" y2="0" style:transform={`translateY(${mergeGuides ? midY : washerY}px)`} />
          <line class="hover-line hover-line-y-d" class:merged={mergeGuides} x1={left} x2={chartWidth - 16} y1="0" y2="0" style:transform={`translateY(${mergeGuides ? midY : dryerY}px)`} />
          <circle class="hover-dot" cx="0" cy="0" style:transform={`translate(${hoverX}px, ${washerY}px)`} r="4" fill="var(--wash)" stroke="var(--panel)" stroke-width="2" />
          <circle class="hover-dot" cx="0" cy="0" style:transform={`translate(${hoverX}px, ${dryerY}px)`} r="4" fill="var(--dry)" stroke="var(--panel)" stroke-width="2" />
        </g>
      </svg>
      <input class="chart-input" type="range" min="0" max={points.length - 1} step="1" value={active ?? 0} aria-label="Explore chart values"
        aria-valuetext={selected ? `${selected.label}, ${selected.washers} washers, ${selected.dryers} dryers` : `${points[0].label}, ${points[0].washers} washers, ${points[0].dryers} dryers`}
        oninput={(event) => showPoint(Number(event.currentTarget.value))} onpointermove={scrub} onpointerdown={scrub}
        onpointerleave={(event) => { if (document.activeElement !== event.currentTarget) active = null; }}
        onfocus={() => { if (active === null) showPoint(0); }} onblur={() => active = null} onkeydown={(event) => { if (event.key === 'Escape') active = null; }} />
        <div class="chart-tooltip" class:visible={active !== null} class:direct={active !== null && !glide} aria-hidden="true"
          bind:clientWidth={tooltipWidth} bind:clientHeight={tooltipHeight} style:transform={`translate(${tooltipX}px, ${tooltipY}px)`}>
          <strong>{selected.label}</strong><span><i class="wash"></i>Washers <b>{selected.washers}</b></span><span><i class="dry"></i>Dryers <b>{selected.dryers}</b></span>
        </div>
    </div>
  </div>
</section>

<style>
  .chart-panel { padding: 20px 22px 14px; border-radius: var(--radius-panel); }
  .chart-header { margin-bottom: 12px; }
  .range { --range-inset: 6px; --range-radius: var(--radius-panel); position: relative; display: grid; grid-template-columns: repeat(8, 1fr); padding: var(--range-inset); border: 1px solid var(--line); border-radius: var(--range-radius); user-select: none; touch-action: pan-y; }
  /* Colors inherit the animated root palette; another transition here lags behind it. */
  .range button { z-index: 1; padding: 7px 12px; border: 0; background: transparent; border-radius: calc(var(--range-radius) - var(--range-inset) - 1px); color: var(--ink); font-size: 13px; cursor: grab; }
  .range button:active { cursor: grabbing; }
  .range button[aria-selected='true'] { color: var(--selected-ink); }
  .range-thumb { position: absolute; left: var(--range-inset); top: var(--range-inset); bottom: var(--range-inset); width: calc((100% - 2 * var(--range-inset)) / 8); border-radius: calc(var(--range-radius) - var(--range-inset) - 1px); background: var(--selected); transition: transform .28s cubic-bezier(.4, 0, .2, 1); }
  .range-thumb.direct { transition: none; }
  .legend { position: absolute; top: 0; right: 16px; display: flex; gap: 16px; font-size: 12px; color: var(--muted); pointer-events: none; }
  .legend span { display: flex; align-items: center; gap: 7px; }
  i { display: inline-block; width: 18px; height: 3px; border-radius: 3px; flex: none; }
  i.wash { background: var(--wash); } i.dry { background: var(--dry); }
  .chart-wrap { position: relative; min-width: 0; }
  svg { display: block; width: 100%; height: 260px; overflow: visible; }
  .grid-line { stroke: var(--line); stroke-width: 1; stroke-dasharray: 2 5; }
  .axis { fill: var(--muted); font-size: 11px; font-family: inherit; }
  .series { fill: none; stroke-width: 2.25; stroke-linecap: round; stroke-linejoin: round; }
  .washers { stroke: var(--wash); } .dryers { stroke: var(--dry); }
  .hover-line { stroke: var(--muted); stroke-dasharray: 3 4; }
  .hover-line, .hover-dot { opacity: 0; pointer-events: none; vector-effect: non-scaling-stroke; transition: transform .14s cubic-bezier(.16, 1, .3, 1), opacity .12s ease-out; }
  .visible .hover-line { opacity: .7; }
  .visible .hover-dot { opacity: 1; }
  .visible .hover-line.merged { opacity: 0; }
  .direct .hover-line, .direct .hover-dot, .chart-tooltip.direct { transition: none; }
  .chart-input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: crosshair; }
  .chart-wrap:has(.chart-input:focus-visible) { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 4px; }
  .chart-tooltip { position: absolute; top: 0; left: 0; width: 154px; padding: 10px 12px; background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius-control); box-shadow: var(--popover-shadow); font-size: 12px; pointer-events: none; opacity: 0; transition: transform .14s cubic-bezier(.16, 1, .3, 1), opacity .12s ease-out; }
  .chart-tooltip.visible { opacity: 1; }
  .chart-tooltip strong { display: block; margin-bottom: 6px; }
  .chart-tooltip span { display: flex; align-items: center; gap: 7px; color: var(--muted); padding: 2px 0; }
  .chart-tooltip i { width: 8px; height: 8px; border-radius: 50%; }
  .chart-tooltip b { margin-left: auto; color: var(--ink); }
  @media (max-width: 600px) {
    .chart-panel { padding: 16px 12px 10px; }
    .range { width: 100%; }
    .range button { padding: 10px 0; font-size: 11px; }
  }
  @media (prefers-reduced-motion: reduce) { .range-thumb, .range button, .hover-line, .hover-dot, .chart-tooltip { transition: none; } }
</style>
