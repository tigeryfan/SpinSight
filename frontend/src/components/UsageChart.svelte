<script lang="ts">
  import type { WeeklyUsage } from '../lib/types';
  import { dayAbbr, shortDate, weekRange, fmtHourLabel } from '../lib/time';

  interface Props {
    usage: WeeklyUsage;
  }
  let { usage }: Props = $props();

  // Aggregate layout
  const AGG_W = 1200;
  const AGG_H = 200;
  const AGG_PAD_L = 40;
  const AGG_PAD_R = 24;
  const AGG_PAD_T = 36;
  const AGG_PAD_B = 28;

  // Daily panel layout
  const DAY_W = 200;
  const DAY_H = 200;
  const DAY_PAD_T = 32;
  const DAY_PAD_B = 28;
  const DAY_PAD_L = 16;
  const DAY_PAD_R = 16;

  // Shared Y scale across all daily panels (and aggregate gets its own)
  const dailyMax = $derived.by(() => {
    let m = 0;
    for (const d of usage.days) {
      for (const h of d.hours) {
        if (h.washersInUse > m) m = h.washersInUse;
        if (h.dryersInUse > m) m = h.dryersInUse;
      }
    }
    return Math.max(6, niceCeil(m));
  });

  const aggMax = $derived.by(() => {
    let m = 0;
    for (const d of usage.aggregate) {
      if (d.washersPeak > m) m = d.washersPeak;
      if (d.dryersPeak > m) m = d.dryersPeak;
    }
    return Math.max(4, niceCeil(m));
  });

  function niceCeil(v: number): number {
    if (v <= 4) return 4;
    if (v <= 6) return 6;
    if (v <= 8) return 8;
    if (v <= 12) return 12;
    if (v <= 16) return 16;
    return Math.ceil(v / 4) * 4;
  }

  // Aggregate coordinate helpers
  const aggInner = {
    left: AGG_PAD_L,
    right: AGG_W - AGG_PAD_R,
    top: AGG_PAD_T,
    bottom: AGG_H - AGG_PAD_B,
  };
  const aggInnerW = aggInner.right - aggInner.left;
  const aggInnerH = aggInner.bottom - aggInner.top;

  function aggX(i: number): number {
    if (usage.aggregate.length <= 1) return aggInner.left + aggInnerW / 2;
    return aggInner.left + (i / (usage.aggregate.length - 1)) * aggInnerW;
  }
  function aggY(val: number): number {
    return aggInner.bottom - (val / aggMax) * aggInnerH;
  }
  function aggPoints(series: 'washers' | 'dryers'): string {
    return usage.aggregate
      .map((d, i) => {
        const x = aggX(i);
        const v = series === 'washers' ? d.washersPeak : d.dryersPeak;
        return `${x.toFixed(2)},${aggY(v).toFixed(2)}`;
      })
      .join(' ');
  }

  // Daily coordinate helpers
  const dayInner = {
    left: DAY_PAD_L,
    right: DAY_W - DAY_PAD_R,
    top: DAY_PAD_T,
    bottom: DAY_H - DAY_PAD_B,
  };
  const dayInnerW = dayInner.right - dayInner.left;
  const dayInnerH = dayInner.bottom - dayInner.top;

  function dayX(hour: number): number {
    return dayInner.left + (hour / 23) * dayInnerW;
  }
  function dayY(val: number): number {
    return dayInner.bottom - (val / dailyMax) * dayInnerH;
  }
  function dayPoints(panelIdx: number, series: 'washers' | 'dryers'): string {
    const day = usage.days[panelIdx];
    return day.hours
      .map((h, i) => {
        const v = series === 'washers' ? h.washersInUse : h.dryersInUse;
        return `${dayX(i).toFixed(2)},${dayY(v).toFixed(2)}`;
      })
      .join(' ');
  }

  // Y-tick sets
  const aggYTicks = $derived(buildTicks(aggMax));
  const dailyYTicks = $derived(buildTicks(dailyMax));

  function buildTicks(max: number): number[] {
    if (max <= 4) return [0, 1, 2, 3, 4];
    if (max <= 8) return [0, 2, 4, 6, 8];
    if (max <= 12) return [0, 3, 6, 9, 12];
    if (max <= 16) return [0, 4, 8, 12, 16];
    return [0, max / 4, max / 2, (3 * max) / 4, max].map((v) => Math.round(v));
  }

  // Hover state
  let aggHover = $state<number | null>(null);
  let dayHover = $state<{ panel: number; hour: number } | null>(null);

  function onAggMove(e: MouseEvent) {
    const target = e.currentTarget as SVGSVGElement;
    const rect = target.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * AGG_W;
    if (usage.aggregate.length <= 1) {
      aggHover = 0;
      return;
    }
    const t = (x - aggInner.left) / aggInnerW;
    const i = Math.round(t * (usage.aggregate.length - 1));
    if (i >= 0 && i < usage.aggregate.length) aggHover = i;
  }
  function onAggLeave() {
    aggHover = null;
  }

  function onDayMove(panelIdx: number, e: MouseEvent) {
    const target = e.currentTarget as SVGSVGElement;
    const rect = target.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * DAY_W;
    const t = (x - dayInner.left) / dayInnerW;
    const hour = Math.round(t * 23);
    if (hour >= 0 && hour <= 23) dayHover = { panel: panelIdx, hour };
  }
  function onDayLeave() {
    dayHover = null;
  }

  // Aggregate readout placement
  const aggReadoutX = $derived.by(() => {
    if (aggHover === null) return 0;
    const x = aggX(aggHover);
    const readoutW = 156;
    if (x + readoutW + 8 > AGG_W - AGG_PAD_R) return x - readoutW - 8;
    return x + 8;
  });
</script>

<div class="wrap">
  <!-- AGGREGATE PANEL -->
  <div class="aggregate">
    <div class="agg-head">
      <div class="agg-titles">
        <span class="kicker mono">WEEK</span>
        <span class="range mono">{weekRange(usage.startDate, usage.days[usage.days.length - 1].date)}</span>
      </div>
      <div class="agg-legend mono">
        <span class="leg"><span class="leg-swatch swatch-washer"></span>WASHER PEAK</span>
        <span class="leg"><span class="leg-swatch swatch-dryer"></span>DRYER PEAK</span>
        <span class="leg-units">UNITS</span>
      </div>
    </div>
    <svg
      viewBox={`0 0 ${AGG_W} ${AGG_H}`}
      width="100%"
      preserveAspectRatio="none"
      class="agg-svg"
      role="img"
      aria-label="Weekly aggregate chart"
      onmousemove={onAggMove}
      onmouseleave={onAggLeave}
    >
      <!-- Y-axis grid + ticks -->
      {#each aggYTicks as t}
        <line
          x1={aggInner.left}
          x2={aggInner.right}
          y1={aggY(t)}
          y2={aggY(t)}
          class="grid-line"
        />
        <text
          x={aggInner.left - 8}
          y={aggY(t) + 3}
          class="tick"
          text-anchor="end"
        >{t}</text>
      {/each}

      <!-- X-axis day labels -->
      {#each usage.aggregate as day, i}
        <text
          x={aggX(i)}
          y={aggInner.bottom + 18}
          class="day-label"
          text-anchor="middle"
        >{dayAbbr(day.date)}</text>
      {/each}

      <!-- Lines -->
      <polyline points={aggPoints('washers')} class="line line-washer" />
      <polyline points={aggPoints('dryers')} class="line line-dryer" />

      <!-- Dots -->
      {#each usage.aggregate as day, i}
        <circle cx={aggX(i)} cy={aggY(day.washersPeak)} r="2.5" class="dot dot-washer" />
        <circle cx={aggX(i)} cy={aggY(day.dryersPeak)} r="2.5" class="dot dot-dryer" />
      {/each}

      <!-- Hover overlay -->
      {#if aggHover !== null}
        {@const d = usage.aggregate[aggHover]}
        <line
          x1={aggX(aggHover)}
          x2={aggX(aggHover)}
          y1={aggInner.top - 4}
          y2={aggInner.bottom + 4}
          class="crosshair"
        />
        <circle cx={aggX(aggHover)} cy={aggY(d.washersPeak)} r="4" class="dot dot-washer dot-lg" />
        <circle cx={aggX(aggHover)} cy={aggY(d.dryersPeak)} r="4" class="dot dot-dryer dot-lg" />
        <g transform={`translate(${aggReadoutX}, ${aggInner.top})`}>
          <rect x="0" y="0" width="156" height="56" class="readout-bg" />
          <text x="10" y="18" class="readout-label">{shortDate(d.date)}</text>
          <text x="10" y="38" class="readout-val-w">{d.washersPeak}</text>
          <text x="42" y="38" class="readout-lbl">W</text>
          <text x="80" y="38" class="readout-val-d">{d.dryersPeak}</text>
          <text x="112" y="38" class="readout-lbl">D</text>
        </g>
      {/if}
    </svg>
  </div>

  <!-- DAILY PANELS -->
  <div class="daily-row">
    {#each usage.days as day, i (day.date)}
      <div class="daily-cell" data-first={i === 0}>
        <div class="day-head">
          <span class="day-name mono">{dayAbbr(day.date)}</span>
          <span class="day-date mono">{shortDate(day.date)}</span>
        </div>
        <svg
          viewBox={`0 0 ${DAY_W} ${DAY_H}`}
          width="100%"
          preserveAspectRatio="none"
          class="day-svg"
          role="img"
          aria-label={`${dayAbbr(day.date)} usage`}
          onmousemove={(e) => onDayMove(i, e)}
          onmouseleave={onDayLeave}
        >
          <!-- Y grid -->
          {#each dailyYTicks as t}
            <line
              x1={dayInner.left}
              x2={dayInner.right}
              y1={dayY(t)}
              y2={dayY(t)}
              class="grid-line"
            />
            <text x={dayInner.left - 4} y={dayY(t) + 3} class="tick" text-anchor="end">{t}</text>
          {/each}

          <!-- X axis labels every 6 hours -->
          {#each [0, 6, 12, 18] as h}
            <text
              x={dayX(h)}
              y={dayInner.bottom + 16}
              class="tick"
              text-anchor="middle"
            >{fmtHourLabel(h)}</text>
          {/each}

          <!-- Lines -->
          <polyline points={dayPoints(i, 'washers')} class="line line-washer" />
          <polyline points={dayPoints(i, 'dryers')} class="line line-dryer" />

          <!-- Hover indicator -->
          {#if dayHover?.panel === i}
            {@const h = day.hours[dayHover.hour]}
            <line
              x1={dayX(dayHover.hour)}
              x2={dayX(dayHover.hour)}
              y1={dayInner.top - 4}
              y2={dayInner.bottom + 4}
              class="crosshair"
            />
            <circle cx={dayX(dayHover.hour)} cy={dayY(h.washersInUse)} r="3.5" class="dot dot-washer dot-lg" />
            <circle cx={dayX(dayHover.hour)} cy={dayY(h.dryersInUse)} r="3.5" class="dot dot-dryer dot-lg" />
            <g transform={`translate(${dayInner.left + 6}, ${dayInner.top + 4})`}>
              <rect x="0" y="0" width="68" height="38" class="readout-bg" />
              <text x="6" y="14" class="readout-label">{fmtHourLabel(dayHover.hour)}</text>
              <text x="6" y="30" class="readout-val-w">{h.washersInUse}</text>
              <text x="22" y="30" class="readout-lbl">W</text>
              <text x="40" y="30" class="readout-val-d">{h.dryersInUse}</text>
              <text x="56" y="30" class="readout-lbl">D</text>
            </g>
          {/if}
        </svg>
      </div>
    {/each}
  </div>
</div>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .aggregate {
    border-top: 1px solid var(--hairline);
    padding-top: var(--s-3);
  }

  .agg-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 8px;
    gap: var(--s-3);
  }

  .agg-titles {
    display: flex;
    align-items: baseline;
    gap: var(--s-3);
  }

  .kicker {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.18em;
    color: var(--text-faint);
  }

  .range {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.08em;
    color: var(--text-dim);
  }

  .agg-legend {
    display: inline-flex;
    align-items: center;
    gap: var(--s-3);
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 0.16em;
    color: var(--text-faint);
  }

  .leg {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .leg-swatch {
    width: 10px;
    height: 2px;
    display: inline-block;
  }

  .swatch-washer {
    background: var(--washer);
  }

  .swatch-dryer {
    background: var(--dryer);
  }

  .leg-units {
    color: var(--text-faint);
    letter-spacing: 0.2em;
  }

  .agg-svg {
    display: block;
    width: 100%;
    aspect-ratio: 1200 / 200;
    cursor: crosshair;
  }

  .daily-row {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    margin-top: var(--s-4);
  }

  .daily-cell {
    border-left: 1px solid var(--hairline);
    padding: var(--s-3) 0 0;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .daily-cell[data-first='true'] {
    border-left: 0;
  }

  .day-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 0 var(--s-3) 6px;
  }

  .day-name {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.18em;
    color: var(--text-faint);
  }

  .day-date {
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 0.1em;
    color: var(--text-faint);
  }

  .day-svg {
    display: block;
    width: 100%;
    aspect-ratio: 200 / 200;
    cursor: crosshair;
  }

  .grid-line {
    stroke: var(--hairline);
    stroke-width: 1;
    shape-rendering: crispEdges;
  }

  .tick {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 400;
    fill: var(--text-faint);
    letter-spacing: 0.04em;
    font-variant-numeric: tabular-nums;
    font-feature-settings: 'tnum' on;
  }

  .day-label {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 600;
    fill: var(--text-dim);
    letter-spacing: 0.16em;
  }

  .line {
    fill: none;
    stroke-width: 1.5;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .line-washer {
    stroke: var(--washer);
  }

  .line-dryer {
    stroke: var(--dryer);
  }

  .dot {
    stroke: var(--ink);
    stroke-width: 0.75;
  }

  .dot-washer {
    fill: var(--washer);
  }

  .dot-dryer {
    fill: var(--dryer);
  }

  .dot-lg {
    stroke-width: 1.25;
  }

  .crosshair {
    stroke: var(--text-dim);
    stroke-width: 1;
    stroke-dasharray: 2 3;
    opacity: 0.7;
  }

  .readout-bg {
    fill: var(--ink-2);
    stroke: var(--hairline-strong);
    stroke-width: 1;
  }

  .readout-label {
    font-family: var(--font-mono);
    font-size: 9px;
    fill: var(--text-dim);
    letter-spacing: 0.08em;
    font-weight: 500;
  }

  .readout-val-w {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 600;
    fill: var(--washer);
    font-variant-numeric: tabular-nums;
    font-feature-settings: 'tnum' on;
  }

  .readout-val-d {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 600;
    fill: var(--dryer);
    font-variant-numeric: tabular-nums;
    font-feature-settings: 'tnum' on;
  }

  .readout-lbl {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 500;
    fill: var(--text-faint);
    letter-spacing: 0.1em;
  }

  @media (max-width: 720px) {
    .daily-row {
      grid-template-columns: 1fr;
    }
    .daily-cell {
      border-left: 0;
      border-top: 1px solid var(--hairline);
      padding: var(--s-3) 0;
    }
    .daily-cell[data-first='true'] {
      border-top: 0;
    }
    .agg-svg {
      aspect-ratio: 1200 / 240;
    }
    .day-svg {
      aspect-ratio: 600 / 200;
    }
  }
</style>
