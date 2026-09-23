<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { dailyUsage, dailyChartAxis, weeklyUsage, weeklyChartBounds, days, dayNames, type Machine, type Snapshot, type UsagePoint } from '../lib/data';
  let { machines, history, dates, animationKey }: { machines: Machine[]; history: Snapshot['history']; dates: Date[]; animationKey: number } = $props();
  let view = $state(-1);
  let width = $state(700);
  let active = $state<number | null>(null);
  let dragState: { pointerId: number; startX: number; startCenter: number } | null = null;
  let dragMoved = false;
  let thumbOffset = $state<number | null>(null);
  let thumbAnimated = $state(true);
  let hoverIndex = $state(0);
  let glide = $state(false);
  let tooltipWidth = $state(154);
  let tooltipHeight = $state(92);
  let chartData: SVGGElement;
  let chartReveal: SVGRectElement;
  let chartAnimation: Animation | undefined;
  let redrawRequest = $state(0);
  let tabs: HTMLDivElement;
  const emptyPoint: UsagePoint = { label: '', timestamp: 0, washers: null, dryers: null };
  let tabBounds = $state<{ center: number; width: number; height: number }[]>([]);
  let thumb = $derived(tabBounds[view + 1]);
  onMount(() => {
    const buttons = Array.from(tabs.querySelectorAll('button'));
    const labels = buttons.map(button => button.querySelector('span')!);
    function measureTabs() {
      const rangeLeft = tabs.getBoundingClientRect().left + tabs.clientLeft;
      const sizes = labels.map(label => label.getBoundingClientRect());
      tabBounds = buttons.map((button, index) => ({
        center: button.getBoundingClientRect().left - rangeLeft + button.getBoundingClientRect().width / 2,
        width: sizes[index].width,
        height: sizes[index].height,
      }));
    }
    const observer = new ResizeObserver(measureTabs);
    observer.observe(tabs);
    labels.forEach(label => observer.observe(label));
    measureTabs();
    return () => observer.disconnect();
  });
  const formatDate = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const formatCount = (value: number | null) => value === null ? 'No data' : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  let points = $derived(view === -1 ? weeklyUsage(machines, history, dates) : dailyUsage(machines, history, dates[view]));
  let weekBounds = $derived(weeklyChartBounds(dates));
  let hasReadings = $derived(points.some(point => point.washers !== null || point.dryers !== null));
  let hasGaps = $derived(points.some(point => point.washers === null || point.dryers === null));
  let maxUsage = $derived(Math.max(0, ...points.flatMap(point => [point.washers ?? 0, point.dryers ?? 0])));
  let tickStep = $derived(Math.max(1, Math.ceil(Math.max(1, maxUsage) / 4)));
  let axisMax = $derived(Math.max(1, tickStep * Math.ceil(Math.max(1, maxUsage) / tickStep)));
  let chartWidth = $derived(Math.max(width, 240));
  const height = 260;
  const left = 32;
  const top = 16;
  const bottom = 226;
  let plotWidth = $derived(chartWidth - left - 16);
  let dayAxis = $derived(view === -1 ? null : dailyChartAxis(dates[view], plotWidth));
  let firstTimestamp = $derived((dayAxis ?? weekBounds)?.start ?? 0);
  let lastTimestamp = $derived((dayAxis ?? weekBounds)?.end ?? firstTimestamp);
  let timeSpan = $derived(Math.max(0, lastTimestamp - firstTimestamp));
  const xAt = (timestamp: number) => {
    if (timeSpan === 0) return left + plotWidth / 2;
    return left + (timestamp - firstTimestamp) / timeSpan * plotWidth;
  };
  const x = (i: number) => xAt(points[i].timestamp);
  const y = (value: number) => bottom - (value / axisMax) * (bottom - top);
  const path = (key: 'washers' | 'dryers', filled = false) => {
    const segments: { index: number; value: number }[][] = [];
    let segment: { index: number; value: number }[] = [];
    points.forEach((point, index) => {
      const value = point[key];
      if (value === null) { if (segment.length) segments.push(segment); segment = []; }
      else segment.push({ index, value: y(value) });
    });
    if (segment.length) segments.push(segment);
    // Keep missing observations as gaps, including the area under each segment.
    return segments.map(values => {
      const deltas = values.slice(1).map((point, i) => point.value - values[i].value);
      const tangents = values.map((_, i) => {
        const before = deltas[i - 1] ?? deltas[i] ?? 0;
        const after = deltas[i] ?? before;
        return before * after <= 0 ? 0 : Math.sign(before) * Math.min(Math.abs(before), Math.abs(after));
      });
      const curve = values.map(({ value, index }, i) => {
        if (i === 0) return `M${x(index)},${value}`;
        const previous = values[i - 1];
        const third = (x(index) - x(previous.index)) / 3;
        return `C${x(previous.index) + third},${previous.value + tangents[i - 1] / 3} ${x(index) - third},${value - tangents[i] / 3} ${x(index)},${value}`;
      }).join(' ');
      return filled ? `${curve} L${x(values[values.length - 1].index)},${bottom} L${x(values[0].index)},${bottom} Z` : curve;
    }).join(' ');
  };
  let ticks = $derived(Array.from({ length: Math.floor(axisMax / tickStep) + 1 }, (_, i) => i * tickStep));
  let weeklyAxisLabels = $derived(view === -1 && weekBounds ? dates.slice(0, 7).map((date, index) => {
    const start = date.getTime();
    const end = index < 6 ? dates[index + 1].getTime() : weekBounds.end;
    return { label: days[index], timestamp: start + (end - start) / 2 };
  }) : []);
  let title = $derived(view === -1 ? 'Last full week' : `${dayNames[view]}, ${formatDate(dates[view])}`);
  let dataKey = $derived(points.map(point => `${point.timestamp}:${point.washers ?? 'x'}:${point.dryers ?? 'x'}`).join('|'));
  let selected = $derived(points[Math.min(hoverIndex, points.length - 1)] ?? emptyPoint);
  let hoverX = $derived(points.length ? x(Math.min(hoverIndex, points.length - 1)) : left + plotWidth / 2);
  let washerY = $derived(y(selected.washers ?? 0));
  let dryerY = $derived(y(selected.dryers ?? 0));
  let midY = $derived((washerY + dryerY) / 2);
  let mergeGuides = $derived(selected.washers !== null && selected.dryers !== null && Math.abs(washerY - dryerY) <= 12);
  let tooltipX = $derived(Math.max(8, Math.min(chartWidth - tooltipWidth - 8,
    hoverX + 12 + tooltipWidth > chartWidth - 8 ? hoverX - tooltipWidth - 12 : hoverX + 12)));
  let tooltipY = $derived(Math.max(8, Math.min(height - tooltipHeight - 8,
    midY + 12 + tooltipHeight > height - 8 ? midY - tooltipHeight - 12 : midY + 12)));

  function redrawChart() {
    if (!chartData || !chartReveal) return;
    chartAnimation?.cancel();
    const revealWidth = `${chartWidth}px`;
    chartReveal.style.width = revealWidth;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    chartReveal.style.width = '0px';
    chartAnimation = chartReveal.animate(
      [{ width: '0px' }, { width: revealWidth }],
      { duration: 520, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'forwards' },
    );
    chartAnimation.onfinish = () => {
      chartReveal.style.width = revealWidth;
      chartAnimation = undefined;
    };
  }

  $effect(() => {
    animationKey;
    dataKey;
    redrawRequest;
    chartWidth;
    void tick().then(() => { if (!dragMoved) redrawChart(); });
  });

  function select(index: number, focus = false, animate = true) {
    if (index === view) return;
    chartAnimation?.cancel();
    view = index; active = null; hoverIndex = 0;
    thumbAnimated = animate;
    if (animate) redrawRequest += 1;
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
    if (!points.length) return;
    glide = active !== null;
    hoverIndex = Math.max(0, Math.min(points.length - 1, index));
    active = hoverIndex;
  }
  function scrub(event: PointerEvent) {
    if (!points.length) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    if (!rect.width) return;
    const chartX = Math.max(left, Math.min(chartWidth - 16, (event.clientX - rect.left) / rect.width * chartWidth));
    const nearest = points.reduce((best, point, index) => Math.abs(x(index) - chartX) < Math.abs(x(best) - chartX) ? index : best, 0);
    showPoint(nearest);
  }
  function startDrag(event: PointerEvent, index: number) {
    if (event.button !== 0) return;
    dragMoved = false;
    thumbOffset = null;
    select(index);
    dragState = { pointerId: event.pointerId, startX: event.clientX, startCenter: tabBounds[index + 1].center };
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
    thumbOffset = Math.max(tabBounds[0].center, Math.min(tabBounds[tabBounds.length - 1].center, dragState.startCenter + dx));
    const nearest = tabBounds.reduce((best, bounds, index) =>
      Math.abs(bounds.center - thumbOffset!) < Math.abs(tabBounds[best].center - thumbOffset!) ? index : best, 0);
    select(nearest - 1, false, false);
  }
  function endDrag(event: PointerEvent) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    dragState = null;
    if (tabs.hasPointerCapture(event.pointerId)) tabs.releasePointerCapture(event.pointerId);
    if (dragMoved) { thumbAnimated = false; thumbOffset = null; }
  }
</script>

<svelte:window onpointerup={endDrag} onpointercancel={endDrag} />
<section class="panel chart-panel" aria-labelledby="usage-title">
  <div class="chart-header">
    <h2 id="usage-title">Usage</h2>
    <div class="range" role="tablist" tabindex="-1" aria-label="Usage period" bind:this={tabs} onkeydown={tabKey} onpointermove={drag}
      onpointerleave={() => { if (!dragMoved) dragState = null; }}>
      <span class="range-thumb" class:direct={!thumbAnimated} style:--usage-pill-width={`${thumb?.width ?? 0}px`} style:--usage-pill-height={`${thumb?.height ?? 0}px`}
        style:--usage-pill-center={`${thumbOffset ?? thumb?.center ?? 0}px`} aria-hidden="true">
        {#each ['Week', ...days] as label, index}
          <span style:left={`${tabBounds[index]?.center ?? 0}px`}>{label}</span>
        {/each}
      </span>
      {#each ['Week', ...days] as label, index}
        <button id={`period-${index}`} role="tab" aria-selected={view === index - 1} aria-controls="usage-panel" tabindex={view === index - 1 ? 0 : -1}
          onclick={(event) => { if (event.detail === 0 || !dragMoved) select(index - 1, false, event.detail !== 0); dragMoved = false; }}
          onpointerdown={(event) => startDrag(event, index - 1)}><span>{label}</span></button>
      {/each}
    </div>
    <div class="legend"><span><i class="wash"></i>Washers</span><span><i class="dry"></i>Dryers</span></div>
  </div>
  <div id="usage-panel" role="tabpanel" aria-labelledby={`period-${view + 1}`}>
    <div class="chart-wrap" bind:clientWidth={width}>
      <svg viewBox={`0 0 ${chartWidth} ${height}`} role="img" aria-label={`${title}: ${view === -1 ? 'daily peak washers and dryers' : 'washers and dryers'} in use. Use the chart slider to explore values.`}>
        <defs>
          <linearGradient id="wash-area" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--wash)" stop-opacity=".18" /><stop offset="1" stop-color="var(--wash)" stop-opacity="0" /></linearGradient>
          <linearGradient id="dry-area" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--dry)" stop-opacity=".14" /><stop offset="1" stop-color="var(--dry)" stop-opacity="0" /></linearGradient>
        </defs>
        <clipPath id="usage-reveal"><rect bind:this={chartReveal} width={chartWidth} height={height} /></clipPath>
        {#each ticks as value}
          <line class="grid-line" x1={left} x2={chartWidth - 16} y1={y(value)} y2={y(value)} />
          <text class="axis" x={left - 10} y={y(value) + 4} text-anchor="end">{value}</text>
        {/each}
        <g class="chart-data" bind:this={chartData} clip-path="url(#usage-reveal)">
          <path d={path('washers', true)} fill="url(#wash-area)" /><path d={path('dryers', true)} fill="url(#dry-area)" />
          <path class="series washers" d={path('washers')} /><path class="series dryers" d={path('dryers')} />
          {#each points as point, index}
            {#each ['washers', 'dryers'] as key}
              {@const value = point[key as 'washers' | 'dryers']}
              {#if value !== null && (points[index - 1]?.[key as 'washers' | 'dryers'] ?? null) === null && (points[index + 1]?.[key as 'washers' | 'dryers'] ?? null) === null}
                <circle cx={x(index)} cy={y(value)} r="3" fill={key === 'washers' ? 'var(--wash)' : 'var(--dry)'} />
              {/if}
            {/each}
          {/each}
        </g>
        {#if !hasReadings}<text class="axis" x={chartWidth / 2} y={height / 2} text-anchor="middle">No readings for this period</text>{/if}
        {#if view === -1}
          {#each weeklyAxisLabels as tick, index}
            <text class="axis" x={xAt(tick.timestamp)} y={height - 9} text-anchor={index === 0 ? 'start' : index === weeklyAxisLabels.length - 1 ? 'end' : 'middle'}>{tick.label}</text>
          {/each}
        {:else}
          {#each dayAxis?.ticks ?? [] as tick}
            <text class="axis" x={xAt(tick.timestamp)} y={height - 9} text-anchor="middle">{tick.label}</text>
          {/each}
        {/if}
        <g class="hover-overlay" class:visible={active !== null && (selected.washers !== null || selected.dryers !== null)} class:direct={active !== null && !glide} aria-hidden="true">
          <line class="hover-line hover-line-x" x1="0" x2="0" y1={top} y2={bottom} style:transform={`translateX(${hoverX}px)`} />
          {#if selected.washers !== null}
            <line class="hover-line hover-line-y-w" x1={left} x2={chartWidth - 16} y1="0" y2="0" style:transform={`translateY(${mergeGuides ? midY : washerY}px)`} />
            <circle class="hover-dot" cx="0" cy="0" style:transform={`translate(${hoverX}px, ${washerY}px)`} r="4" fill="var(--wash)" stroke="var(--panel)" stroke-width="2" />
          {/if}
          {#if selected.dryers !== null}
            <line class="hover-line hover-line-y-d" class:merged={mergeGuides && selected.washers !== null} x1={left} x2={chartWidth - 16} y1="0" y2="0" style:transform={`translateY(${mergeGuides ? midY : dryerY}px)`} />
            <circle class="hover-dot" cx="0" cy="0" style:transform={`translate(${hoverX}px, ${dryerY}px)`} r="4" fill="var(--dry)" stroke="var(--panel)" stroke-width="2" />
          {/if}
        </g>
      </svg>
      <input class="chart-input" type="range" min="0" max={Math.max(0, points.length - 1)} step="1" value={active ?? 0} aria-label="Explore chart values" disabled={points.length === 0}
        aria-valuetext={`${selected.label}, washers: ${formatCount(selected.washers)}, dryers: ${formatCount(selected.dryers)}`}
        oninput={(event) => showPoint(Number(event.currentTarget.value))} onpointermove={scrub} onpointerdown={scrub}
        onpointerleave={(event) => { if (document.activeElement !== event.currentTarget) active = null; }}
        onfocus={() => { if (active === null) showPoint(0); }} onblur={() => active = null} onkeydown={(event) => { if (event.key === 'Escape') active = null; }} />
        <div class="chart-tooltip" class:visible={active !== null} class:direct={active !== null && !glide} aria-hidden="true"
          bind:clientWidth={tooltipWidth} bind:clientHeight={tooltipHeight} style:transform={`translate(${tooltipX}px, ${tooltipY}px)`}>
          <strong>{selected.label}</strong><span><i class="wash"></i>Washers <b>{formatCount(selected.washers)}</b></span><span><i class="dry"></i>Dryers <b>{formatCount(selected.dryers)}</b></span>
        </div>
    </div>
  </div>
  <p class="history-note">{#if view === -1}{formatDate(dates[0])}–{formatDate(dates[6])}{:else}{formatDate(dates[view])}{/if}{#if view === -1} · Daily peak of recorded running counts.{/if}{#if hasGaps} · Gaps mean no readings were available.{/if}</p>
</section>

<style>
  @property --usage-pill-center { syntax: '<length>'; inherits: false; initial-value: 0px; }
  @property --usage-pill-width { syntax: '<length>'; inherits: false; initial-value: 0px; }
  @property --usage-pill-height { syntax: '<length>'; inherits: false; initial-value: 0px; }
  .chart-panel { container-type: inline-size; padding: 20px 22px 14px; border-radius: var(--radius-panel); }
  h2 { grid-area: title; }
  .chart-header { display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-areas: 'title legend' 'range range'; align-items: center; gap: 6px 16px; margin-bottom: 12px; }
  .range { grid-area: range; justify-self: start; min-width: 0; --range-inset: 3px; --range-radius: var(--radius-control); position: relative; display: flex; gap: 6px; padding: 0; border: 0; border-radius: var(--range-radius); user-select: none; touch-action: pan-y; }
  /* Colors inherit the animated root palette; another transition here lags behind it. */
  .range button { flex: none; display: flex; align-items: center; justify-content: center; z-index: 1; padding: 0; border: 0; background: transparent; border-radius: calc(var(--range-radius) - var(--range-inset) - 1px); color: var(--ink); font-size: 12px; line-height: 18px; cursor: grab; }
  .range button:active { cursor: grabbing; }
  .range button span { display: inline-block; padding: 3px; }
  /* The pill clips its background and selected text together, including mid-letter overlaps. */
  .range-thumb { position: absolute; inset: 0; z-index: 2; pointer-events: none; background: var(--selected); color: var(--selected-ink); font-size: 12px; line-height: 18px;
    clip-path: inset(calc(50% - var(--usage-pill-height) / 2) calc(100% - var(--usage-pill-center) - var(--usage-pill-width) / 2) calc(50% - var(--usage-pill-height) / 2) calc(var(--usage-pill-center) - var(--usage-pill-width) / 2) round calc(var(--range-radius) - var(--range-inset) - 1px));
    transition: --usage-pill-center .28s cubic-bezier(.4, 0, .2, 1), --usage-pill-width .28s cubic-bezier(.4, 0, .2, 1), --usage-pill-height .28s cubic-bezier(.4, 0, .2, 1); }
  .range-thumb > span { position: absolute; top: 50%; transform: translate(-50%, -50%); white-space: nowrap; }
  .range-thumb.direct { transition: --usage-pill-width .18s cubic-bezier(.16, 1, .3, 1), --usage-pill-height .18s cubic-bezier(.16, 1, .3, 1); }
  .legend { grid-area: legend; justify-self: end; display: flex; gap: 16px; font-size: 12px; color: var(--muted); pointer-events: none; }
  .legend span { display: flex; align-items: center; gap: 7px; }
  i { display: inline-block; width: 18px; height: 3px; border-radius: 3px; flex: none; }
  i.wash { background: var(--wash); } i.dry { background: var(--dry); }
  .chart-wrap { position: relative; min-width: 0; }
  .history-note { margin: 8px 0 0; color: var(--muted); font-size: 11px; }
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
  }
  @container (max-width: 499px) {
    .range { width: 100%; justify-content: space-between; gap: 4px; }
    .range button { padding: 6px 0; font-size: 11px; }
    .range-thumb { font-size: 11px; }
    .range button span { padding: 4px; }
  }
  @container (min-width: 500px) {
    .chart-header { grid-template-columns: auto auto 1fr; grid-template-areas: 'title range legend'; column-gap: 12px; }
    .range { gap: 2px; }
  }
  @container (min-width: 660px) {
    .chart-header { column-gap: 16px; }
    .range { gap: 6px; }
  }
  @media (prefers-reduced-motion: reduce) { .range-thumb, .range-thumb.direct, .range button, .hover-line, .hover-dot, .chart-tooltip { transition: none; } }
</style>
