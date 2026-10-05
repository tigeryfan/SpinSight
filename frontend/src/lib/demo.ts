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

function machineNumber(name: string): number {
  const match = name.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : 0;
}

function machineName(number: number, type: 'Washer' | 'Dryer'): string {
  return `${type === 'Washer' ? 'W' : 'D'}${number}`;
}

// Hour-of-day and day-of-week usage curve.
//
// Mon-Fri peaks at 8PM (dryers at 9PM) at 60% of total capacity, with a small
// 6-8AM wave and a sparse 1-2 machines running every hour between 8AM-5PM.
// Sat-Sun follows a gradual bell through 8AM-8PM peaking around 2PM (dryers
// 3PM) at 80% of total capacity. Bernoulli variance keeps weekday counts away
// from the chart ceiling (0.60^16 ≈ 0.0003 chance of all 16 running) while
// letting weekend peaks occasionally fill it (0.80^16 ≈ 0.03 chance).
function liveFraction(date: Date, type: 'Washer' | 'Dryer'): number {
  const hour = date.getHours() + date.getMinutes() / 60;
  const day = date.getDay();
  const isWeekend = day === 0 || day === 6;

  if (isWeekend) {
    // Outside 8AM-8PM, machines stay in quiet baseline.
    if (hour < 8 || hour > 20) return 0.05;
    // Bell curve centered at 14:00 (dryers at 15:00), half-width 6 hours.
    const peakHour = type === 'Washer' ? 14 : 15;
    const halfWidth = 6;
    const x = (hour - peakHour) / halfWidth;
    const bell = Math.max(0, Math.cos(x * Math.PI / 2));
    return 0.05 + bell * 0.75; // 0.05 .. 0.80
  }

  // Weekday curve: dryers lag washers by one hour because the wash cycle that
  // just finished produces the dryer load.
  const peakHour = type === 'Washer' ? 20 : 21;

  if (hour < 6) return 0.05;
  if (hour < 8) {
    // 6-8AM bump centered at 7AM: 0.05 .. 0.20.
    const x = (hour - 7) / 1;
    return 0.05 + Math.max(0, Math.cos(x * Math.PI / 2)) * 0.15;
  }
  if (hour < 17) {
    // 8AM-5PM: 1-2 machines running every hour across all dorms. A small sine
    // wave breathes the line so it does not look perfectly flat.
    const wave = Math.sin((hour - 8) * Math.PI / 4.5) * 0.02;
    return 0.12 + wave; // ~0.10 .. 0.14
  }
  if (hour < peakHour) {
    // 5PM-rise to 8PM (dryers 9PM) peak at 0.60.
    const riseHours = peakHour - 17;
    const x = (hour - 17) / riseHours;
    return 0.15 + x * 0.45;
  }
  if (hour < peakHour + 3) {
    // 8PM (dryers 9PM) peak at 0.60 declining to 0.10 three hours later.
    const x = (hour - peakHour) / 3;
    return 0.60 - x * 0.50;
  }
  return 0.05;
}

// Build one machine snapshot for a given seed and poll time. The status is
// fully determined by seed + pollTime so the latest history row and the latest
// machines array can share a single source of truth.
function buildRow(seed: number, dorm: string, number: number, type: 'Washer' | 'Dryer', pollTime: Date): MachineSnapshot {
  const fraction = liveFraction(pollTime, type);
  const isLive = pick(seed, 1, 1000) / 1000 < fraction;
  const duration = cycleMinutes[type];
  // minutesLeft spans the full cycle [1, duration] so each row has a believable
  // countdown regardless of where in the cycle the synthetic poll landed.
  const minutesLeft = isLive ? pick(seed, 11, duration - 1) + 1 : 0;
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
 *  current hour and uses an epoch-based seed so each Refresh redraws the
 *  chart's right-most point, the stats, and the per-machine progress bars.
 *  Older history rows use a stable per-hour seed so the past pattern stays
 *  the same across refreshes. Each Running row's minutesLeft is redrawn from
 *  the full [1, duration] range so the cards stay varied even late in the
 *  hour (otherwise elapsed-time subtraction would pin everyone to 1m). */
export function generateDemoPayload(dates: Date[], now: Date = new Date()): DemoPayload {
  const latestPoll = snapToHour(now);
  // Per-second seed so refreshes that cross a second boundary show fresh
  // minutesLeft values; within the same second the countdowns are stable.
  const epochSeed = Math.floor(now.getTime() / 1000);
  const hourly = 60 * 60_000;
  const historyWeeks = 4;
  const totalHours = 24 * 7 * historyWeeks;

  // Build the full history series first, oldest first. The latest row uses
  // epochSeed so it varies on Refresh; older rows use hourSeed so the past
  // pattern stays stable across refreshes. Each dorm's rows are checked
  // individually so every dorm always shows at least one running machine,
  // even during quiet hours when the random draws would otherwise leave the
  // entire dorm Available.
  const history: MachineSnapshot[] = [];
  for (let hourOffset = 0; hourOffset < totalHours; hourOffset += 1) {
    const pollTime = new Date(latestPoll.getTime() - hourOffset * hourly);
    const isLatestRow = hourOffset === 0;
    const rowSeed = isLatestRow ? epochSeed : Math.floor(pollTime.getTime() / hourly);
    for (const group of demoAssignments) {
      const dormRows: MachineSnapshot[] = [];
      for (const number of group.numbers) {
        for (const type of ['Washer', 'Dryer'] as const) {
          const seed = rowSeed + number + (type === 'Washer' ? 0 : 9973);
          dormRows.push(buildRow(seed, group.dorm, number, type, pollTime));
        }
      }
      if (!dormRows.some(row => row.status === 'Running')) {
        const firstByNumber = [...dormRows].sort((a, b) => machineNumber(a.machine_name ?? a.bluetooth_address) - machineNumber(b.machine_name ?? b.bluetooth_address))[0];
        const originalIndex = dormRows.indexOf(firstByNumber);
        const type = firstByNumber.machine_type as 'Washer' | 'Dryer';
        const duration = cycleMinutes[type];
        const seed = rowSeed + machineNumber(firstByNumber.machine_name ?? firstByNumber.bluetooth_address) + (type === 'Washer' ? 0 : 9973);
        const minutesLeft = pick(seed, 23, duration - 1) + 1;
        const eta = new Date(pollTime.getTime() + minutesLeft * 60_000).toISOString();
        dormRows[originalIndex] = { ...firstByNumber, status: 'Running', estimated_completion_time: eta };
      }
      for (const row of dormRows) history.push(row);
    }
  }

  // Latest machines mirror the latest history row so the chart's right edge
  // matches the stats and individual machine cards. poll_time is bumped to
  // `now` so the dashboard shows a current reading, and minutesLeft gets a
  // bounded drift on top of the same [1, duration] range used by buildRow so
  // values stay varied instead of all collapsing to 1m as the hour elapses.
  const latest: MachineSnapshot[] = history
    .filter((row) => new Date(row.poll_time).getTime() === latestPoll.getTime())
    .map((row) => {
      if (row.status !== 'Running' || !row.estimated_completion_time) {
        return { ...row, poll_time: now.toISOString() };
      }
      const number = machineNumber(row.machine_name ?? row.bluetooth_address);
      const type = row.machine_type as 'Washer' | 'Dryer';
      const duration = cycleMinutes[type];
      const seed = epochSeed + number + (type === 'Washer' ? 0 : 9973);
      const baseMinutesLeft = pick(seed, 11, duration - 1) + 1; // 1..duration
      const drift = pick(seed, 19, 7) - 3; // -3..+3
      const minutesLeft = Math.max(1, Math.min(duration, baseMinutesLeft + drift));
      return {
        ...row,
        poll_time: now.toISOString(),
        estimated_completion_time: new Date(now.getTime() + minutesLeft * 60_000).toISOString(),
      };
    });

  return { machines: latest, history, refreshedAt: now.toISOString() };
}