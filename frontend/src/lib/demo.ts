import type { MachineSnapshot } from '../../../worker/src/types';

// Same roster as real dorms.ts so demo mode shows the actual machine names,
// dorm groups, and counts that the dashboard expects.
const demoAssignments: Array<{ dorm: string; numbers: number[] }> = [
  { dorm: 'Alamo', numbers: [5, 6, 7] },
  { dorm: 'Upper Dorms', numbers: [8, 9, 10, 11, 12] },
  { dorm: 'South Hutch', numbers: [1, 2] },
  { dorm: 'North Hutch', numbers: [3, 4] },
  { dorm: 'Appleby', numbers: [18, 19, 20, 21] },
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
// the wash cycles that just finished. Curve is shifted up so the day's mean
// sits around 75% utilization, the realistic steady-state of a full dorm.
function liveFraction(date: Date, type: 'Washer' | 'Dryer'): number {
  const hour = date.getHours() + date.getMinutes() / 60;
  const phaseShift = type === 'Washer' ? 0 : 1;
  const phase = ((hour - 9 + phaseShift) / 24) * 2 * Math.PI;
  const curve = (Math.sin(phase) + 1) / 2;
  return Math.min(1, 0.6 + curve * 0.4);
}

function weeklyMultiplier(date: Date): number {
  const day = date.getDay();
  if (day === 0) return 0.7;
  if (day === 6) return 0.85;
  return 1;
}

function machineNumber(name: string): number {
  const match = name.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : 0;
}

function machineName(number: number, type: 'Washer' | 'Dryer'): string {
  return `${type === 'Washer' ? 'W' : 'D'}${number}`;
}

// Build one machine snapshot for a given seed and poll time. The status is
// fully determined by seed + pollTime so the latest history row and the
// latest machines array can share a single source of truth.
function buildRow(seed: number, dorm: string, number: number, type: 'Washer' | 'Dryer', pollTime: Date): MachineSnapshot {
  const fraction = liveFraction(pollTime, type) * weeklyMultiplier(pollTime);
  const livePick = pick(seed, 1, 100) / 100;
  const isLive = livePick < fraction;
  const duration = cycleMinutes[type];
  const minutesLeft = isLive ? pick(seed, 11, Math.max(1, duration - 1)) + 1 : 0;
  const status = isLive ? 'Running' : 'Available';
  const eta = status === 'Running' ? new Date(pollTime.getTime() + minutesLeft * 60_000).toISOString() : '';
  const name = machineName(number, type);
  return {
    bluetooth_address: name,
    poll_time: pollTime.toISOString(),
    machine_name: name,
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

export interface DemoPayload {
  machines: MachineSnapshot[];
  history: MachineSnapshot[];
  refreshedAt: string;
}

export const demoDorms: string[] = demoAssignments.map((group) => group.dorm);

// Snap every synthetic poll to the top of the current hour so chart axis
// labels land on :00 marks, matching the daily view's anchor. Each refresh
// then drifts the running countdown inside that hour without changing the
// underlying Running/Available status, so the stats and individual machine
// cards stay in sync with the chart's right-most point.
function snapToHour(now: Date): Date {
  const snapped = new Date(now);
  snapped.setMinutes(0, 0, 0);
  return snapped;
}

/** Build a synthetic dashboard payload. The latest poll rides the top of the
 *  current hour; the latest history row uses the same seed so its status
 *  matches the machines array. A per-second drift is layered onto minutesLeft
 *  so manual Refreshes show new countdown values without touching status. */
export function generateDemoPayload(dates: Date[], now: Date = new Date()): DemoPayload {
  const latestPoll = snapToHour(now);
  // Per-second seed so refreshes that cross a second boundary show fresh
  // minutesLeft values; within the same second the countdowns are stable.
  const epochSeed = Math.floor(now.getTime() / 1000);
  const hourly = 60 * 60_000;
  const historyWeeks = 4;
  const totalHours = 24 * 7 * historyWeeks;

  // Build the full history series first, oldest first. The latest row in
  // history lives at latestPoll so the chart's most recent point is the same
  // snapshot the machines array exposes.
  const history: MachineSnapshot[] = [];
  for (let hourOffset = 0; hourOffset < totalHours; hourOffset += 1) {
    const pollTime = new Date(latestPoll.getTime() - hourOffset * hourly);
    const hourSeed = Math.floor(pollTime.getTime() / hourly);
    for (const group of demoAssignments) {
      for (const number of group.numbers) {
        for (const type of ['Washer', 'Dryer'] as const) {
          const seed = hourSeed + number + (type === 'Washer' ? 0 : 9973);
          history.push(buildRow(seed, group.dorm, number, type, pollTime));
        }
      }
    }
  }

  // Latest machines mirror the latest history row so the chart's right edge
  // matches the stats and individual machine cards. poll_time is bumped to
  // `now` so the dashboard shows a current reading, and minutesLeft gets a
  // bounded per-second drift to feel responsive on Refresh.
  const elapsedMs = now.getTime() - latestPoll.getTime();
  const elapsedMinutes = Math.floor(elapsedMs / 60_000);
  const latest: MachineSnapshot[] = history
    .filter((row) => new Date(row.poll_time).getTime() === latestPoll.getTime())
    .map((row) => {
      const drift = pick(epochSeed + machineNumber(row.machine_name ?? row.bluetooth_address), 19, 7) - 3;
      if (row.status !== 'Running' || !row.estimated_completion_time) {
        return { ...row, poll_time: now.toISOString() };
      }
      const baseMinutesLeft = Math.ceil((Date.parse(row.estimated_completion_time) - latestPoll.getTime()) / 60_000);
      const minutesLeft = Math.max(1, baseMinutesLeft - elapsedMinutes + drift);
      return {
        ...row,
        poll_time: now.toISOString(),
        estimated_completion_time: new Date(now.getTime() + minutesLeft * 60_000).toISOString(),
      };
    });

  return { machines: latest, history, refreshedAt: now.toISOString() };
}