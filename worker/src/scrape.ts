import type { Env } from './env';
import { fetchGreenwaldRoomView } from './upstream';
import { insertSnapshots } from './store';
import type { GreenwaldMachine, MachineSnapshot, ScrapeResult } from './types';
import { withRetry, type RetryOpts } from './retry';

export class RefreshError extends Error {}

/** Convert raw machine to snapshot */
function toMachineSnapshot(raw: GreenwaldMachine, pollTime: string): MachineSnapshot {
  return {
    bluetooth_address: raw.bluetoothAddress,
    poll_time: pollTime,
    machine_name: raw.machineName,
    location_name: raw.locationName,
    status: raw.status,
    platform_type: raw.platformType,
    machine_type: raw.machineType,
    estimated_completion_time: raw.estimatedCompletionTime,
    top_off_available: raw.topOffAvailable ? 1 : 0,
    multi_top_off_available: raw.multiTopOffAvailable ? 1 : 0,
    super_cycle_available: raw.superCycleAvailable ? 1 : 0,
    top_off_cost: raw.topOffCost,
    minutes_per_top_off: raw.minutesPerTopOff,
  };
}

/** Core scrape logic */
export async function runScrape(env: Env): Promise<ScrapeResult> {
  const retryOpts: RetryOpts = {
    maxAttempts: 5,
    baseDelayMs: 1000,
    maxDelayMs: 60000,
    jitter: 'full',
    isRetryable: (err, res) => {
      if (res) {
        if (res.status === 429) return true;
        if (res.status >= 500) return true;
        return false;
      }
      // Network or other errors are retryable
      return true;
    },
    onRetry: (info) => {
      console.warn(`Retry attempt ${info.attempt} after ${info.delayMs}ms: ${info.reason}`);
    },
  };

  let machines: GreenwaldMachine[];
  try {
    machines = await withRetry(() => fetchGreenwaldRoomView(env), retryOpts);
  } catch (error) {
    throw new RefreshError('Unable to refresh machine data.', { cause: error });
  }

  const pollTime = new Date().toISOString();
  const snapshots = machines.map((m) => toMachineSnapshot(m, pollTime));
  await insertSnapshots(env, snapshots);
  console.info(`Scrape completed ${pollTime}: fetched ${machines.length}, inserted ${snapshots.length}`);
  return { pollTime, count: snapshots.length };
}

// Demo assignments mirror the on-campus machine numbering the frontend uses to
// group machines by dorm. Numbers expand the per-dorm roster so the dashboard
// has enough machines for the chart and per-dorm breakdowns to feel real.
const demoAssignments: Array<{ dorm: string; numbers: number[] }> = [
  { dorm: 'Alamo', numbers: [5, 6, 7, 13, 14, 15] },
  { dorm: 'Upper Dorms', numbers: [8, 9, 10, 11, 12, 16, 17] },
  { dorm: 'South Hutch', numbers: [1, 2, 22, 23] },
  { dorm: 'North Hutch', numbers: [3, 4, 24, 25] },
  { dorm: 'Appleby', numbers: [18, 19, 20, 21, 26, 27, 28] },
];

// A tiny deterministic hash so consecutive demo polls look different but stay
// stable inside a single poll, so the UI does not flicker between renders.
function pick(seed: number, salt: number, mod: number): number {
  const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return Math.floor((value - Math.floor(value)) * mod);
}

function cycleDurationMinutes(type: string): number {
  return type === 'Washer' ? 37 : type === 'Dryer' ? 45 : 30;
}

// Active share of a dorm's roster varies with the time of day: late-night is
// mostly idle, afternoon/evening is busiest. Returns a 0..1 fraction of the
// roster that should currently be Running.
function liveFraction(date: Date): number {
  const hour = date.getHours() + date.getMinutes() / 60;
  // Skewed sine over the 24h cycle, peak ~18:00, trough ~04:00.
  const phase = ((hour - 9) / 24) * 2 * Math.PI;
  const curve = (Math.sin(phase) + 1) / 2; // 0..1
  return 0.18 + curve * 0.55; // 0.18..0.73
}

// Weekly cycle: weekends run a bit lighter, especially Sunday morning.
function weeklyMultiplier(date: Date): number {
  const day = date.getDay();
  if (day === 0) return 0.7;
  if (day === 6) return 0.85;
  return 1.0;
}

interface DemoBuild {
  status: 'Running' | 'Available' | 'Completed';
  minutesLeft: number;
}

function buildStatus(seed: number, isLive: boolean, type: string): DemoBuild {
  // Within the live slice, bias toward mid-cycle so the "next" countdown looks varied.
  const duration = cycleDurationMinutes(type);
  const minutesLeft = pick(seed, 11, Math.max(1, duration - 1)) + 1;
  if (!isLive) {
    const idle = pick(seed, 12, 3);
    return idle === 0
      ? { status: 'Completed', minutesLeft: 0 }
      : { status: 'Available', minutesLeft: 0 };
  }
  return { status: 'Running', minutesLeft };
}

function buildDemoMachine(seed: number, dorm: string, number: number, type: string, now: Date): GreenwaldMachine {
  const fraction = liveFraction(now) * weeklyMultiplier(now);
  const livePick = pick(seed, 1, 100) / 100;
  const isLive = livePick < fraction;
  const { status, minutesLeft } = buildStatus(seed, isLive, type);
  const eta = status === 'Running' ? new Date(now.getTime() + minutesLeft * 60_000).toISOString() : '';
  return {
    machineName: `${type === 'Washer' ? 'W' : 'D'}${number}`,
    locationName: dorm,
    bluetoothAddress: `demo-${type === 'Washer' ? 'W' : 'D'}${number}`,
    status,
    platformType: 'Greenwald',
    estimatedCompletionTime: eta,
    machineType: type,
    topOffAvailable: type === 'Washer' && pick(seed, 3, 2) === 0,
    multiTopOffAvailable: type === 'Washer' && pick(seed, 13, 4) === 0,
    superCycleAvailable: type === 'Washer' && pick(seed, 4, 4) === 0,
    topOffCost: type === 'Washer' ? 1 : null,
    minutesPerTopOff: type === 'Washer' ? 12 : null,
  };
}

function buildHistoryMachines(seed: number, dorm: string, number: number, type: string, pollTime: Date): GreenwaldMachine {
  // Hourly history uses a coarser status so the chart peak counter moves day to day.
  const fraction = liveFraction(pollTime) * weeklyMultiplier(pollTime);
  const livePick = pick(seed, 5, 100) / 100;
  const isLive = livePick < fraction;
  const duration = cycleDurationMinutes(type);
  const minutesLeft = isLive ? pick(seed, 6, Math.max(1, duration - 2)) + 1 : 0;
  const status: 'Running' | 'Available' = isLive ? 'Running' : 'Available';
  const eta = status === 'Running' ? new Date(pollTime.getTime() + minutesLeft * 60_000).toISOString() : '';
  return {
    machineName: `${type === 'Washer' ? 'W' : 'D'}${number}`,
    locationName: dorm,
    bluetoothAddress: `demo-${type === 'Washer' ? 'W' : 'D'}${number}`,
    status,
    platformType: 'Greenwald',
    estimatedCompletionTime: eta,
    machineType: type,
    topOffAvailable: type === 'Washer' && pick(seed, 7, 2) === 0,
    multiTopOffAvailable: false,
    superCycleAvailable: false,
    topOffCost: type === 'Washer' ? 1 : null,
    minutesPerTopOff: type === 'Washer' ? 12 : null,
  };
}

/** Persist a full set of demo machines plus four weeks of varied history so
 *  the usage chart has realistic day/night and weekday/weekend peaks. Clears
 *  prior demo rows so storage does not grow without bound. */
export async function runDemoScrape(env: Env): Promise<ScrapeResult> {
  const now = new Date();
  const pollTime = now.toISOString();
  // Use a 5-minute seed so demo refreshes feel responsive but a single render
  // stays stable against itself.
  const epochSeed = Math.floor(now.getTime() / (5 * 60_000));

  const latest: MachineSnapshot[] = [];
  for (const group of demoAssignments) {
    for (const number of group.numbers) {
      for (const type of ['Washer', 'Dryer']) {
        const raw = buildDemoMachine(epochSeed + number, group.dorm, number, type, now);
        latest.push(toMachineSnapshot(raw, pollTime));
      }
    }
  }

  const history: MachineSnapshot[] = [];
  const hourly = 60 * 60_000;
  const historyWeeks = 4;
  const totalHours = 24 * 7 * historyWeeks;
  for (let hourOffset = 1; hourOffset <= totalHours; hourOffset += 1) {
    const pollTimeAtHour = new Date(now.getTime() - hourOffset * hourly);
    const seed = Math.floor(pollTimeAtHour.getTime() / hourly);
    for (const group of demoAssignments) {
      for (const number of group.numbers) {
        for (const type of ['Washer', 'Dryer']) {
          const raw = buildHistoryMachines(seed + number, group.dorm, number, type, pollTimeAtHour);
          history.push(toMachineSnapshot(raw, pollTimeAtHour.toISOString()));
        }
      }
    }
  }

  await env.DB.prepare('DELETE FROM machine_snapshots WHERE bluetooth_address LIKE ?').bind('demo-%').run();
  await insertSnapshots(env, [...latest, ...history]);
  console.info(`Demo scrape completed ${pollTime}: inserted ${latest.length} latest, ${history.length} history`);
  return { pollTime, count: latest.length };
}