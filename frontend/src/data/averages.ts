// Pure averaging over raw usage observations. No I/O, no React.
//
// The chart only ever consumes pre-averaged data — it never averages inline.
// Day view = average every 30 minutes. Week view = average every day of the
// week. Both shapes index by weekday Mon..Sun so the day view can look up
// just the slot array it needs.

import type { UsageObservation, UsagePoint } from "./types";

// 48 thirty-minute slots per day: 00:00, 00:30, ..., 23:30.
const HALF_HOURS_PER_DAY = 48;

const ISO_DAY_LENGTH = 10;        // "YYYY-MM-DD"
const ISO_HOUR_LENGTH = 2;

// Mon = 0 .. Sun = 6, matching Date.getDay() with Monday as week start.
function weekdayIndex(iso: string): number {
  return (new Date(iso).getDay() + 6) % 7;
}

// Slot index 0..47 for a timestamp.
function halfHourSlot(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 2 + (d.getMinutes() >= 30 ? 1 : 0);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, ISO_DAY_LENGTH);
}

// Most recent Monday-on-or-before ref, then each weekday in order Mon..Sun.
// The bucket labels reuse these dates so the chart's date-derived weekday
// labels stay in sync.
function weekdayDates(ref: Date): Date[] {
  const start = new Date(ref);
  start.setHours(0, 0, 0, 0);
  const daysSinceMonday = (start.getDay() + 6) % 7;
  const monday = new Date(start);
  monday.setDate(monday.getDate() - daysSinceMonday);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isoHalfHour(dayIso: string, slot: number): string {
  const hour = Math.floor(slot / 2);
  const minute = slot % 2 === 0 ? 0 : 30;
  return (
    dayIso +
    "T" +
    hour.toString().padStart(ISO_HOUR_LENGTH, "0") +
    ":" +
    minute.toString().padStart(ISO_HOUR_LENGTH, "0")
  );
}

// Average over every observation that landed on each weekday. Returns 7
// buckets Mon..Sun, each bucket keyed to the most recent occurrence of that
// weekday relative to `ref`.
export function averageByWeekday(
  observations: UsageObservation[],
  ref: Date = new Date()
): UsagePoint[] {
  const slots: { washer: number[]; dryer: number[] }[] = Array.from(
    { length: 7 },
    () => ({ washer: [], dryer: [] })
  );
  for (const o of observations) {
    const idx = weekdayIndex(o.timestamp);
    slots[idx].washer.push(o.washer);
    slots[idx].dryer.push(o.dryer);
  }
  const dates = weekdayDates(ref);
  return slots.map((s, i) => ({
    bucket: isoDay(dates[i]),
    washer: mean(s.washer),
    dryer: mean(s.dryer),
  }));
}

// Average over every observation in each 30-minute slot of each weekday.
// Returns 7 arrays of 48 buckets, indexed Mon..Sun. The inner bucket label
// is a full timestamp (YYYY-MM-DDTHH:MM) using the most recent occurrence
// of that weekday, so the chart can read it back as a date.
export function averageByWeekdayHalfHour(
  observations: UsageObservation[],
  ref: Date = new Date()
): UsagePoint[][] {
  const byWeekday: UsageObservation[][] = Array.from(
    { length: 7 },
    () => []
  );
  for (const o of observations) {
    byWeekday[weekdayIndex(o.timestamp)].push(o);
  }
  const dates = weekdayDates(ref);
  return byWeekday.map((dayObs, dow) => {
    const slots: { washer: number[]; dryer: number[] }[] = Array.from(
      { length: HALF_HOURS_PER_DAY },
      () => ({ washer: [], dryer: [] })
    );
    for (const o of dayObs) {
      const slot = halfHourSlot(o.timestamp);
      slots[slot].washer.push(o.washer);
      slots[slot].dryer.push(o.dryer);
    }
    const dayIso = isoDay(dates[dow]);
    return slots.map((s, i) => ({
      bucket: isoHalfHour(dayIso, i),
      washer: mean(s.washer),
      dryer: mean(s.dryer),
    }));
  });
}
