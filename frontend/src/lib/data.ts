export const dorms = ['Upper Dorms', 'Alamo', 'North Hutch', 'South Hutch', 'Appleby', 'Jones', 'Jameson'] as const;
export const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export type MachineType = 'Washer' | 'Dryer';
export type MachineStatus = 'Running' | 'Completed' | 'Available';
export interface Machine {
  id: string;
  dorm: string;
  machineName: string;
  machineType: MachineType;
  status: MachineStatus;
  progress: number;
  minutesLeft: number;
  usageHoursPastWeek: number;
  topOffAvailable: boolean;
}
export interface UsagePoint { label: string; washers: number; dryers: number }
export interface Snapshot { machines: Machine[]; refreshedAt: Date }

function hash(value: string) {
  let result = 0;
  for (const char of value) result = ((result * 31) + char.charCodeAt(0)) | 0;
  return Math.abs(result);
}

// The machine names, statuses, and dorm assignment match mockup.html.
export function createMachines(): Machine[] {
  const bias = [1.2, 0.8, 1, 1.1, 0.9, 1, 0.85];
  return (['Washer', 'Dryer'] as const).flatMap(machineType =>
    Array.from({ length: 21 }, (_, index) => {
      const number = index + 1;
      const dormIndex = Math.floor(index / 3);
      const dorm = dorms[dormIndex];
      const machineName = `${machineType === 'Washer' ? 'W' : 'D'}${number}`;
      const running = machineType === 'Washer' ? number === 7 : [1, 5, 7, 13, 18, 19, 21].includes(number);
      const progress = running ? 0.35 + (index % 3) * 0.2 : 1;
      return {
        id: `${dorm}-${machineName}`, dorm, machineName, machineType,
        status: running ? 'Running' : 'Completed', progress,
        minutesLeft: running ? Math.max(1, Math.round((1 - progress) * 35)) : 0,
        usageHoursPastWeek: Math.max(0.5, Math.round((hash(`${dorm}|${machineName}|${machineType}`) % 220) * bias[dormIndex]) / 10),
        topOffAvailable: machineType === 'Dryer' && running,
      };
    }),
  );
}

// An async boundary for eventual API integration. Refresh re-reads the same demo fixture.
export async function loadSnapshot(): Promise<Snapshot> {
  await new Promise(resolve => setTimeout(resolve, 350));
  return { machines: createMachines(), refreshedAt: new Date() };
}

export function filterMachines(machines: Machine[], dorm: string) {
  return dorm === 'All Dorms' ? machines : machines.filter(machine => machine.dorm === dorm);
}

export function summary(machines: Machine[], type: MachineType) {
  const typed = machines.filter(machine => machine.machineType === type);
  const active = typed.filter(machine => machine.status === 'Running');
  return {
    total: typed.length,
    // Retain the mockup's non-running count; the UI explains awaiting-unload cycles.
    available: typed.length - active.length,
    next: [...active].sort((a, b) => a.minutesLeft - b.minutesLeft).at(0),
  };
}

export function usageRank(machine: Machine, machines: Machine[]) {
  const ranked = machines.filter(item => item.machineType === machine.machineType)
    .sort((a, b) => b.usageHoursPastWeek - a.usageHoursPastWeek || a.machineName.localeCompare(b.machineName, undefined, { numeric: true }));
  return { rank: ranked.findIndex(item => item.id === machine.id) + 1, total: ranked.length };
}

export function lastFullWeek(now = new Date()) {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) - 7);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(day.getDate() + index);
    return day;
  });
}

// Aggregate per-machine synthetic history so every dorm and all-dorm totals agree.
export function dailyUsage(machines: Machine[], day: number): UsagePoint[] {
  const profile = [0.05, 0.04, 0.03, 0.03, 0.04, 0.06, 0.1, 0.18, 0.32, 0.48, 0.58, 0.55, 0.45, 0.42, 0.46, 0.55, 0.68, 0.8, 0.92, 0.95, 0.88, 0.72, 0.45, 0.2];
  return profile.map((occupancy, hour) => {
    const point = { label: `${hour.toString().padStart(2, '0')}:00`, washers: 0, dryers: 0 };
    for (const machine of machines) {
      const seed = hash(`${machine.id}:${day}:${hour}:usage`);
      const random = ((seed * 16807) % 2147483647) / 2147483647;
      const threshold = machine.machineType === 'Washer' ? occupancy : occupancy * 0.85 + 0.05;
      if (random < threshold) point[machine.machineType === 'Washer' ? 'washers' : 'dryers']++;
    }
    return point;
  });
}

export function weeklyUsage(machines: Machine[]): UsagePoint[] {
  return days.map((label, day) => {
    const hours = dailyUsage(machines, day);
    return {
      label,
      washers: Number((hours.reduce((sum, point) => sum + point.washers, 0) / 24).toFixed(1)),
      dryers: Number((hours.reduce((sum, point) => sum + point.dryers, 0) / 24).toFixed(1)),
    };
  });
}
