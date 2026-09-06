import type { Dorm, DormId, Machine, UsagePoint, UsageSeries } from "./types";

// Deterministic PRNG so the same dorm renders the same data on every load.
// Swap this file for a fetch() call when the backend lands.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const DORMS: Dorm[] = [
  { id: "jameson", name: "Jameson" },
  { id: "upper-dorms", name: "Upper Dorms" },
  { id: "alamo", name: "Alamo" },
  { id: "jones", name: "Jones" },
  { id: "appleby", name: "Appleby" },
  { id: "north-hutch", name: "North Hutch" },
  { id: "south-hutch", name: "South Hutch" },
];

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function generateWeeklyUsage(dormId: DormId, totalMachines: number): UsageSeries {
  const rand = mulberry32(seedFromId(dormId + ":usage"));

  // Daily usage profile: lower weekday mornings, peak Sun/Mon evenings.
  const weekdayProfile = [0.18, 0.22, 0.34, 0.48, 0.66, 0.82, 0.94];
  // Hourly profile for the 1d view: lunchtime + evening peaks.
  const hourlyProfile = [
    0.04, 0.02, 0.02, 0.02, 0.04, 0.08, 0.14, 0.22,
    0.34, 0.42, 0.48, 0.54, 0.58, 0.62, 0.66, 0.7,
    0.74, 0.78, 0.72, 0.6, 0.46, 0.32, 0.2, 0.1,
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Week view: 7 days ending today.
  const week: UsagePoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const isoDay = (d.getDay() + 6) % 7; // Monday = 0
    const base = weekdayProfile[isoDay];
    const washer = round1(totalMachines * 0.6 * base * (0.85 + rand() * 0.3));
    const dryer = round1(totalMachines * 0.6 * base * (0.85 + rand() * 0.3));
    week.push({
      bucket: d.toISOString().slice(0, 10),
      washer,
      dryer,
    });
  }

  // Hourly view: last 7 days, 24 buckets per day.
  const hourly: UsagePoint[] = [];
  for (let day = 6; day >= 0; day--) {
    for (let h = 0; h < 24; h++) {
      const d = new Date(today);
      d.setDate(d.getDate() - day);
      d.setHours(h, 0, 0, 0);
      const base = hourlyProfile[h];
      // Slight weekday modulation so the hourly series varies across days.
      const dow = (d.getDay() + 6) % 7;
      const dowMod = weekdayProfile[dow];
      const washer = round1(totalMachines * 0.5 * base * (0.6 + dowMod * 0.8) * (0.85 + rand() * 0.3));
      const dryer = round1(totalMachines * 0.5 * base * (0.6 + dowMod * 0.8) * (0.85 + rand() * 0.3));
      hourly.push({
        bucket: d.toISOString().slice(0, 13) + ":00",
        washer,
        dryer,
      });
    }
  }

  return { dormId, week, hourly };
}

interface DormConfig {
  washers: number;
  dryers: number;
}

const DORM_CONFIG: Record<DormId, DormConfig> = {
  "jameson":     { washers: 12, dryers: 12 },
  "upper-dorms": { washers: 10, dryers: 10 },
  "alamo":       { washers: 8,  dryers: 8 },
  "jones":       { washers: 8,  dryers: 8 },
  "appleby":     { washers: 6,  dryers: 6 },
  "north-hutch": { washers: 6,  dryers: 6 },
  "south-hutch": { washers: 6,  dryers: 6 },
};

function generateMachines(dormId: DormId): Machine[] {
  const rand = mulberry32(seedFromId(dormId + ":machines"));
  const cfg = DORM_CONFIG[dormId];
  const out: Machine[] = [];

  const make = (kind: "washer" | "dryer", index: number) => {
    const cycleMinutes = kind === "washer" ? 32 : 45;
    const r = rand();
    let status: Machine["status"];
    let elapsed = 0;
    let eta = 0;
    if (r < 0.45) {
      status = "available";
    } else if (r < 0.9) {
      status = "running";
      elapsed = Math.floor(rand() * (cycleMinutes - 4)) + 2;
      eta = cycleMinutes - elapsed;
    } else if (r < 0.98) {
      status = "almost_done";
      elapsed = cycleMinutes - Math.floor(rand() * 3) - 1;
      eta = cycleMinutes - elapsed;
    } else {
      status = "out_of_order";
    }
    out.push({
      id: `${dormId}-${kind}-${index + 1}`,
      dormId,
      kind,
      label: `${kind === "washer" ? "W" : "D"}${(index + 1).toString().padStart(2, "0")}`,
      status,
      cycleMinutes,
      elapsedMinutes: elapsed,
      etaMinutes: eta,
    });
  };

  for (let i = 0; i < cfg.washers; i++) make("washer", i);
  for (let i = 0; i < cfg.dryers; i++) make("dryer", i);
  return out;
}

// Cache by dorm + refresh key so a refresh regenerates the data, but normal
// re-renders stay stable.
const usageCache = new Map<string, UsageSeries>();
const machineCache = new Map<string, Machine[]>();

function cacheKey(dormId: DormId, refreshKey: number): string {
  return `${dormId}#${refreshKey}`;
}

export function getUsage(dormId: DormId, refreshKey = 0): UsageSeries {
  const key = cacheKey(dormId, refreshKey);
  const cached = usageCache.get(key);
  if (cached) return cached;
  const total = (DORM_CONFIG[dormId].washers + DORM_CONFIG[dormId].dryers);
  const series = generateWeeklyUsage(dormId, total);
  usageCache.set(key, series);
  return series;
}

export function getMachines(dormId: DormId, refreshKey = 0): Machine[] {
  const key = cacheKey(dormId, refreshKey);
  const cached = machineCache.get(key);
  if (cached) return cached;
  const list = generateMachines(dormId);
  machineCache.set(key, list);
  return list;
}
