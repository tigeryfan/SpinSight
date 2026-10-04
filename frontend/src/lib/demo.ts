import type { MachineSnapshot } from '../../../worker/src/types';

// Demo roster mirrors the on-campus machine numbering so the dashboard
// layout (dorms, machine counts, dropdown options) matches real data.
const demoAssignments: Array<{ dorm: string; numbers: number[] }> = [
  { dorm: 'Alamo', numbers: [5, 6, 7, 13, 14, 15] },
  { dorm: 'Upper Dorms', numbers: [8, 9, 10, 11, 12, 16, 17] },
  { dorm: 'South Hutch', numbers: [1, 2, 22, 23] },
  { dorm: 'North Hutch', numbers: [3, 4, 24, 25] },
  { dorm: 'Appleby', numbers: [18, 19, 20, 21, 26, 27, 28] },
];

const cycleMinutes = { Washer: 37, Dryer: 45 };

// Deterministic hash so consecutive polls during the same render stay stable
// and only the minutesLeft/eta drift between refreshes.
function pick(seed: number, salt: number, mod: number): number {
  const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return Math.floor((value - Math.floor(value)) * mod);
}

// Active share of a dorm's roster rises into the evening and drops at night.
// Washers peak slightly earlier than dryers, which lag because they follow
// the wash cycles that just finished.
function liveFraction(date: Date, type: 'Washer' | 'Dryer'): number {
  const hour = date.getHours() + date.getMinutes() / 60;
  const phaseShift = type === 'Washer' ? 0 : 1;
  const phase = ((hour - 9 + phaseShift) / 24) * 2 * Math.PI;
  const curve = (Math.sin(phase) + 1) / 2;
  return 0.18 + curve * 0.55;
}

function weeklyMultiplier(date: Date): number {
  const day = date.getDay();
  if (day === 0) return 0.7;
  if (day === 6) return 0.85;
  return 1;
}

interface DemoBuild {
  status: 'Running' | 'Available' | 'Completed';
  minutesLeft: number;
}

function buildStatus(seed: number, isLive: boolean, type: 'Washer' | 'Dryer'): DemoBuild {
  const duration = cycleMinutes[type];
  const minutesLeft = pick(seed, 11, Math.max(1, duration - 1)) + 1;
  if (!isLive) {
    const idle = pick(seed, 12, 3);
    return idle === 0
      ? { status: 'Completed', minutesLeft: 0 }
      : { status: 'Available', minutesLeft: 0 };
  }
  return { status: 'Running', minutesLeft };
}

function machineAddress(dorm: string, number: number, type: 'Washer' | 'Dryer'): string {
  return `demo-${type === 'Washer' ? 'W' : 'D'}${number}-${dorm.replace(/\s+/g, '')}`;
}

function machineName(number: number, type: 'Washer' | 'Dryer'): string {
  return `${type === 'Washer' ? 'W' : 'D'}${number}`;
}

function buildDemoMachine(seed: number, dorm: string, number: number, type: 'Washer' | 'Dryer', now: Date): MachineSnapshot {
  const fraction = liveFraction(now, type) * weeklyMultiplier(now);
  const livePick = pick(seed, 1, 100) / 100;
  const isLive = livePick < fraction;
  const { status, minutesLeft } = buildStatus(seed, isLive, type);
  const eta = status === 'Running' ? new Date(now.getTime() + minutesLeft * 60_000).toISOString() : '';
  return {
    bluetooth_address: machineAddress(dorm, number, type),
    poll_time: now.toISOString(),
    machine_name: machineName(number, type),
    location_name: dorm,
    status,
    platform_type: 'Greenwald',
    machine_type: type,
    estimated_completion_time: eta,
    top_off_available: type === 'Washer' && pick(seed, 3, 2) === 0 ? 1 : 0,
    multi_top_off_available: type === 'Washer' && pick(seed, 13, 4) === 0 ? 1 : 0,
    super_cycle_available: type === 'Washer' && pick(seed, 4, 4) === 0 ? 1 : 0,
    top_off_cost: type === 'Washer' ? 1 : null,
    minutes_per_top_off: type === 'Washer' ? 12 : null,
  };
}

function buildHistoryRow(seed: number, dorm: string, number: number, type: 'Washer' | 'Dryer', pollTime: Date): MachineSnapshot {
  const fraction = liveFraction(pollTime, type) * weeklyMultiplier(pollTime);
  const livePick = pick(seed, 5, 100) / 100;
  const isLive = livePick < fraction;
  const duration = cycleMinutes[type];
  const minutesLeft = isLive ? pick(seed, 6, Math.max(1, duration - 2)) + 1 : 0;
  const status = isLive ? 'Running' : 'Available';
  const eta = isLive ? new Date(pollTime.getTime() + minutesLeft * 60_000).toISOString() : '';
  return {
    bluetooth_address: machineAddress(dorm, number, type),
    poll_time: pollTime.toISOString(),
    machine_name: machineName(number, type),
    location_name: dorm,
    status,
    platform_type: 'Greenwald',
    machine_type: type,
    estimated_completion_time: eta,
    top_off_available: type === 'Washer' && pick(seed, 7, 2) === 0 ? 1 : 0,
    multi_top_off_available: 0,
    super_cycle_available: 0,
    top_off_cost: type === 'Washer' ? 1 : null,
    minutes_per_top_off: type === 'Washer' ? 12 : null,
  };
}

export interface DemoPayload {
  machines: MachineSnapshot[];
  history: MachineSnapshot[];
  refreshedAt: string;
}

export const demoDorms: string[] = demoAssignments.map((group) => group.dorm);

/** Build a synthetic dashboard payload. Each call produces a fresh dataset
 *  driven by the current second, so a manual Refresh shows new minutesLeft
 *  values and shifted active counts without persisting anywhere. */
export function generateDemoPayload(dates: Date[], now: Date = new Date()): DemoPayload {
  // Refresh every second so manual Refreshes show new minutesLeft and eta values.
  const epochSeed = Math.floor(now.getTime() / 1000);
  const latest: MachineSnapshot[] = [];
  for (const group of demoAssignments) {
    for (const number of group.numbers) {
      for (const type of ['Washer', 'Dryer'] as const) {
        const seed = epochSeed + number + (type === 'Washer' ? 0 : 9973);
        latest.push(buildDemoMachine(seed, group.dorm, number, type, now));
      }
    }
  }

  const history: MachineSnapshot[] = [];
  const hourly = 60 * 60_000;
  const historyWeeks = 4;
  const totalHours = 24 * 7 * historyWeeks;
  for (let hourOffset = 1; hourOffset <= totalHours; hourOffset += 1) {
    const pollTimeAtHour = new Date(now.getTime() - hourOffset * hourly);
    const hourSeed = Math.floor(pollTimeAtHour.getTime() / hourly);
    for (const group of demoAssignments) {
      for (const number of group.numbers) {
        for (const type of ['Washer', 'Dryer'] as const) {
          const seed = hourSeed + number + (type === 'Washer' ? 0 : 9973);
          history.push(buildHistoryRow(seed, group.dorm, number, type, pollTimeAtHour));
        }
      }
    }
  }

  return { machines: latest, history, refreshedAt: now.toISOString() };
}
