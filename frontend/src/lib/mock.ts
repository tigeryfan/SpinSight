import type {
  Dorm,
  DailyUsage,
  DayTotal,
  HourUsage,
  Machine,
  WeeklyUsage,
} from './types';

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DormDef {
  id: string;
  name: string;
  machineCount: number;
  /** shifts the evening peak earlier (negative) or later (positive) */
  peakShift: number;
}

const DORM_DEFS: DormDef[] = [
  { id: 'mor', name: 'Morrison', machineCount: 12, peakShift: 0 },
  { id: 'war', name: 'Warren', machineCount: 10, peakShift: -2 },
  { id: 'hil', name: 'Hill House', machineCount: 14, peakShift: 3 },
  { id: 'cas', name: 'Castle', machineCount: 8, peakShift: -1 },
  { id: 'riv', name: 'Riverside', machineCount: 11, peakShift: 1 },
];

function dormSeed(seed: number, dormId: string): number {
  let h = seed >>> 0;
  for (let i = 0; i < dormId.length; i++) {
    h = ((h << 5) - h + dormId.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function generateDorms(seed: number): Dorm[] {
  const rand = mulberry32(seed);
  return DORM_DEFS.map<Dorm>((def) => {
    const machines: Machine[] = [];
    let washers = 0;
    let dryers = 0;
    for (let i = 0; i < def.machineCount; i++) {
      const type: 'washer' | 'dryer' = rand() < 0.5 ? 'washer' : 'dryer';
      if (type === 'washer') washers++;
      else dryers++;
      const seq = type === 'washer' ? washers : dryers;
      const num = String(seq).padStart(2, '0');
      const id = `${def.id.toUpperCase()}-${type === 'washer' ? 'W' : 'D'}-${num}`;

      const r = rand();
      let status: 'available' | 'running' | 'done';
      if (r < 0.6) status = 'available';
      else if (r < 0.95) status = 'running';
      else status = 'done';

      let progress = 0;
      let remainingMinutes = 0;
      if (status === 'running') {
        progress = Math.floor(8 + rand() * 84); // 8..92
        const total =
          type === 'washer' ? 38 + Math.floor(rand() * 12) : 55 + Math.floor(rand() * 18);
        remainingMinutes = Math.max(1, Math.round(total * (1 - progress / 100)));
      } else if (status === 'done') {
        progress = 100;
      }

      machines.push({ id, type, status, progress, remainingMinutes });
    }
    return { id: def.id, name: def.name, machines };
  });
}

function getWeekStart(reference: Date): Date {
  const d = new Date(reference);
  const dow = d.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function peakHourValue(hour: number, isWeekend: boolean, peakShift: number, rand: () => number): number {
  let base: number;
  if (hour < 6) base = rand() * 3; // 0..3
  else if (hour < 9) base = 2 + rand() * 5; // 2..7
  else if (hour < 16) base = 3 + rand() * 6 + (isWeekend ? 2 : 0); // 3..9 weekday, 5..11 weekend
  else if (hour < 22) base = 6 + rand() * 7; // 6..13
  else base = 1 + rand() * 4; // 1..5

  // shift evening peak by peakShift hours
  if (hour >= 17 && hour <= 21) base = Math.max(0, base + peakShift);
  return Math.max(0, Math.round(base));
}

export function generateWeeklyUsage(seed: number, dormId: string): WeeklyUsage {
  const def = DORM_DEFS.find((d) => d.id === dormId) ?? DORM_DEFS[0];
  const rand = mulberry32(dormSeed(seed, dormId));
  const start = getWeekStart(new Date());
  const days: DailyUsage[] = [];
  const aggregate: DayTotal[] = [];

  for (let d = 0; d < 7; d++) {
    const date = new Date(start);
    date.setDate(start.getDate() + d);
    const isWeekend = d === 5 || d === 6;
    const hours: HourUsage[] = [];
    for (let h = 0; h < 24; h++) {
      const total = peakHourValue(h, isWeekend, def.peakShift, rand);
      const washersInUse = Math.max(0, Math.round(total * (0.55 + rand() * 0.1)));
      const dryersInUse = Math.max(0, Math.round(total * (0.5 + rand() * 0.1)));
      hours.push({ hour: h, washersInUse, dryersInUse });
    }
    days.push({ date: isoDate(date), hours });
    const washersPeak = hours.reduce((m, h) => Math.max(m, h.washersInUse), 0);
    const dryersPeak = hours.reduce((m, h) => Math.max(m, h.dryersInUse), 0);
    aggregate.push({ date: isoDate(date), washersPeak, dryersPeak });
  }

  return {
    startDate: isoDate(start),
    aggregate,
    days,
  };
}
