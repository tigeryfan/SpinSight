import { useId, useMemo } from "react";
import type { UsagePoint } from "../data/types";
import { DaySelector, type WeekdayKey } from "./DaySelector";
import styles from "./UsageGraph.module.css";

interface Props {
  week: UsagePoint[];
  hourly: UsagePoint[];
  selected: WeekdayKey;
  onSelect: (key: WeekdayKey) => void;
}

const VIEW_W = 800;
const VIEW_H = 280;
const PAD = { top: 16, right: 24, bottom: 28, left: 44 };

interface Prepared {
  series: { washer: number[]; dryer: number[] };
  xLabels: string[];
  yMax: number;
  title: string;
  granularity: "day" | "hour";
  weekdayAverage: boolean;
}

function prepare(
  week: UsagePoint[],
  hourly: UsagePoint[],
  selected: WeekdayKey
): Prepared {
  if (selected === "7d") {
    // Order Mon..Sun using the trailing week's dates.
    const ordered = [...week].sort((a, b) => dowOrder(a.bucket) - dowOrder(b.bucket));
    const ys = ordered.flatMap((p) => [p.washer, p.dryer]);
    const yMax = niceMax(Math.max(1, ...ys));
    return {
      series: { washer: ordered.map((p) => p.washer), dryer: ordered.map((p) => p.dryer) },
      xLabels: ordered.map((p) => weekdayLabel(p.bucket)),
      yMax,
      title: "Average machines used by weekday",
      granularity: "day",
      weekdayAverage: true,
    };
  }
  // Per-weekday view: average the matching weekday across all hourly buckets.
  // With one trailing week this collapses to the single day, but the data
  // path supports averaging across additional weeks when present.
  const targetDow = dowIndex(selected);
  const matchingDays = collectWeekdays(hourly, targetDow);
  const hourBuckets: number[][] = Array.from({ length: 24 }, () => []);
  for (const day of matchingDays) {
    for (let h = 0; h < 24; h++) {
      hourBuckets[h].push(day.washer[h]);
      hourBuckets[h].push(day.dryer[h]);
    }
  }
  const washer = hourBuckets.map((bucket) => avg(bucket.filter((_, i) => i % 2 === 0)));
  const dryer = hourBuckets.map((bucket) => avg(bucket.filter((_, i) => i % 2 === 1)));
  const ys = [...washer, ...dryer];
  const yMax = niceMax(Math.max(1, ...ys));
  return {
    series: { washer, dryer },
    xLabels: Array.from({ length: 24 }, (_, h) => hourLabel(h)),
    yMax,
    title: `Average ${capitalize(selected)} usage`,
    granularity: "hour",
    weekdayAverage: true,
  };
}

function collectWeekdays(
  hourly: UsagePoint[],
  targetDow: number
): { washer: number[]; dryer: number[] }[] {
  // Group hourly buckets by date, then keep days whose weekday matches.
  const byDate = new Map<string, number[]>();
  for (const p of hourly) {
    const date = p.bucket.slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, new Array(24).fill(0));
    const hour = parseInt(p.bucket.slice(11, 13), 10);
    byDate.get(date)![hour] = p.washer;
  }
  const dryersByDate = new Map<string, number[]>();
  for (const p of hourly) {
    const date = p.bucket.slice(0, 10);
    if (!dryersByDate.has(date)) dryersByDate.set(date, new Array(24).fill(0));
    const hour = parseInt(p.bucket.slice(11, 13), 10);
    dryersByDate.get(date)![hour] = p.dryer;
  }
  const out: { washer: number[]; dryer: number[] }[] = [];
  for (const [date, washerHours] of byDate) {
    const d = new Date(date + "T00:00:00");
    if (d.getDay() === targetDow) {
      out.push({ washer: washerHours, dryer: dryersByDate.get(date) ?? new Array(24).fill(0) });
    }
  }
  return out;
}

function dowIndex(key: Exclude<WeekdayKey, "7d">): number {
  // Matches Date.getDay() where 0=Sun, 1=Mon, ..., 6=Sat.
  const map: Record<Exclude<WeekdayKey, "7d">, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };
  return map[key];
}

function dowOrder(iso: string): number {
  // Sort key: Mon=0, Tue=1, ..., Sun=6.
  const d = new Date(iso + "T00:00:00");
  return (d.getDay() + 6) % 7;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function niceMax(n: number): number {
  if (n <= 4) return 4;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  const norm = n / pow;
  let step: number;
  if (norm <= 1) step = 1;
  else if (norm <= 2) step = 2;
  else if (norm <= 5) step = 5;
  else step = 10;
  return step * pow;
}

function weekdayLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][(d.getDay() + 6) % 7] ?? "";
}

function hourLabel(h: number): string {
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  return h > 12 ? `${h - 12}p` : `${h}a`;
}

function pathFor(values: number[], yMax: number, plotW: number, plotH: number, plotX: number, plotY: number): string {
  if (values.length === 0) return "";
  const stepX = values.length === 1 ? 0 : plotW / (values.length - 1);
  return values
    .map((v, i) => {
      const x = plotX + i * stepX;
      const y = plotY + plotH - (v / yMax) * plotH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function areaPath(values: number[], yMax: number, plotW: number, plotH: number, plotX: number, plotY: number): string {
  if (values.length === 0) return "";
  const line = pathFor(values, yMax, plotW, plotH, plotX, plotY);
  const stepX = values.length === 1 ? 0 : plotW / (values.length - 1);
  const lastX = plotX + (values.length - 1) * stepX;
  const baseY = plotY + plotH;
  return `${line} L${lastX.toFixed(2)},${baseY.toFixed(2)} L${plotX.toFixed(2)},${baseY.toFixed(2)} Z`;
}

export function UsageGraph({ week, hourly, selected, onSelect }: Props) {
  const titleId = useId();
  const prepared = useMemo(() => prepare(week, hourly, selected), [week, hourly, selected]);
  const { series, xLabels, yMax, title, granularity } = prepared;

  const plotX = PAD.left;
  const plotY = PAD.top;
  const plotW = VIEW_W - PAD.left - PAD.right;
  const plotH = VIEW_H - PAD.top - PAD.bottom;

  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => Math.round((yMax * i) / yTickCount));

  const labelStride = xLabels.length > 12 ? Math.ceil(xLabels.length / 6) : 1;
  const stepX = series.washer.length === 1 ? 0 : plotW / (series.washer.length - 1);

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <p className={styles.subtitle}>
            Mean across the trailing week, sampled per {granularity}
          </p>
        </div>
        <div className={styles.controls}>
          <Legend />
          <DaySelector selected={selected} onSelect={onSelect} />
        </div>
      </header>

      <div className={styles.chartWrap}>
        <svg
          className={styles.chart}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Usage chart. Washer mean ${avg(series.washer).toFixed(1)} machines in use, dryer mean ${avg(series.dryer).toFixed(1)}.`}
        >
          <g className={styles.grid} aria-hidden="true">
            {yTicks.map((t) => {
              const y = plotY + plotH - (t / yMax) * plotH;
              return (
                <line
                  key={`y-${t}`}
                  x1={plotX}
                  x2={plotX + plotW}
                  y1={y}
                  y2={y}
                  stroke="var(--border)"
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
              );
            })}
            {xLabels.map((_, i) => {
              if (i % labelStride !== 0 && i !== xLabels.length - 1) return null;
              const x = plotX + i * stepX;
              return (
                <line
                  key={`x-${i}`}
                  x1={x}
                  x2={x}
                  y1={plotY}
                  y2={plotY + plotH}
                  stroke="var(--border)"
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
              );
            })}
          </g>

          <g className={styles.yLabels} aria-hidden="true">
            {yTicks.map((t) => {
              const y = plotY + plotH - (t / yMax) * plotH;
              return (
                <text
                  key={`yl-${t}`}
                  x={plotX - 8}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={11}
                  fontFamily="var(--font-num)"
                  fill="var(--ink-3)"
                >
                  {t}
                </text>
              );
            })}
          </g>

          <g className={styles.xLabels} aria-hidden="true">
            {xLabels.map((label, i) => {
              if (i % labelStride !== 0 && i !== xLabels.length - 1) return null;
              const x = plotX + i * stepX;
              return (
                <text
                  key={`xl-${i}`}
                  x={x}
                  y={plotY + plotH + 16}
                  textAnchor="middle"
                  fontSize={11}
                  fontFamily="var(--font-num)"
                  fill="var(--ink-3)"
                >
                  {label}
                </text>
              );
            })}
          </g>

          <path
            className={styles.area}
            style={{ animationDelay: "0.5s" }}
            d={areaPath(series.dryer, yMax, plotW, plotH, plotX, plotY)}
            fill="var(--dryer-soft)"
          />
          <path
            className={styles.area}
            style={{ animationDelay: "0.4s" }}
            d={areaPath(series.washer, yMax, plotW, plotH, plotX, plotY)}
            fill="var(--washer-soft)"
          />

          <path
            className={styles.line}
            style={{ animationDelay: "0.5s" }}
            d={pathFor(series.dryer, yMax, plotW, plotH, plotX, plotY)}
            pathLength={1}
            fill="none"
            stroke="var(--dryer)"
            strokeWidth={1.6}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            className={styles.line}
            style={{ animationDelay: "0.4s" }}
            d={pathFor(series.washer, yMax, plotW, plotH, plotX, plotY)}
            pathLength={1}
            fill="none"
            stroke="var(--washer)"
            strokeWidth={1.6}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </section>
  );
}

function Legend() {
  return (
    <div className={styles.legend} role="list" aria-label="Series">
      <span role="listitem" className={styles.legendItem}>
        <span className={styles.swatch} style={{ background: "var(--washer)" }} aria-hidden="true" />
        Washer
      </span>
      <span role="listitem" className={styles.legendItem}>
        <span className={styles.swatch} style={{ background: "var(--dryer)" }} aria-hidden="true" />
        Dryer
      </span>
    </div>
  );
}
