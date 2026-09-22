import type { MachineSnapshot } from '../../../worker/src/types';
import { machineDorm } from './dorms';
export type { MachineSnapshot } from '../../../worker/src/types';

export const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export type MachineType = 'Washer' | 'Dryer';

export interface Machine {
  id: string;
  dorm: string;
  machineName: string;
  machineType: string;
  status: string;
  progress: number | null;
  minutesLeft: number | null;
  estimatedComplete: boolean;
  usageHoursPastWeek: number | null;
  topOffAvailable: boolean;
  pollTime: string;
  estimatedCompletionTime: string | null;
}

export interface UsagePoint { label: string; washers: number | null; dryers: number | null }
export interface Snapshot {
  machines: Machine[];
  history: MachineSnapshot[];
  refreshedAt: Date | null;
  dates: Date[];
}

interface DashboardResponse {
  machines: MachineSnapshot[];
  history: MachineSnapshot[];
  refreshedAt: string | null;
}

const apiBase = import.meta.env?.VITE_API_BASE_URL || 'https://api.spinsight.xyz';
const minute = 60_000;
const scheduledPollInterval = 30 * minute;

function timestamp(value: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

async function requestJson(url: URL): Promise<unknown> {
  const response = await fetch(url, { method: 'GET', cache: 'no-store' });
  if (!response.ok) throw new Error(`Request failed (${response.status}).`);
  return response.json();
}

function isRecord(value: unknown): value is MachineSnapshot {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.bluetooth_address === 'string' && row.bluetooth_address.length > 0
    && typeof row.poll_time === 'string' && timestamp(row.poll_time) !== null
    && ['machine_name', 'location_name', 'status', 'machine_type', 'estimated_completion_time']
      .every(key => row[key] === null || typeof row[key] === 'string')
    && typeof row.top_off_available === 'number';
}

export function lastFullWeek(now = new Date()): Date[] {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) - 7);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(day.getDate() + index);
    return day;
  });
}

function weekEnd(dates: Date[]): Date {
  const end = new Date(dates[6]);
  end.setDate(end.getDate() + 1);
  return end;
}

// Estimate observed running time after each poll, stopping at the next observation,
// ETA, or 30-minute scheduled interval. Missing gaps are never filled beyond that cap.
// These are estimates from samples, not complete measured cycle durations.
function observedHours(history: MachineSnapshot[], dates: Date[]): Map<string, number> {
  const start = dates[0].getTime();
  const end = weekEnd(dates).getTime();
  const byMachine = new Map<string, MachineSnapshot[]>();
  for (const row of history) {
    const time = timestamp(row.poll_time);
    if (time === null || time < start || time >= end) continue;
    const rows = byMachine.get(row.bluetooth_address) ?? [];
    rows.push(row);
    byMachine.set(row.bluetooth_address, rows);
  }
  const hours = new Map<string, number>();
  for (const [id, rows] of byMachine) {
    rows.sort((a, b) => Date.parse(a.poll_time) - Date.parse(b.poll_time));
    let duration = 0;
    rows.forEach((row, index) => {
      if (row.status !== 'Running') return;
      const time = Date.parse(row.poll_time);
      const next = rows[index + 1] ? Date.parse(rows[index + 1].poll_time) : end;
      const eta = timestamp(row.estimated_completion_time) ?? end;
      duration += Math.max(0, Math.min(next, eta, time + scheduledPollInterval, end) - time);
    });
    hours.set(id, duration / (60 * minute));
  }
  return hours;
}

export async function loadSnapshot(now = new Date()): Promise<Snapshot> {
  const dates = lastFullWeek(now);
  const url = new URL('/v1/dashboard', apiBase);
  url.searchParams.set('start', dates[0].toISOString());
  url.searchParams.set('end', weekEnd(dates).toISOString());
  const payload = await requestJson(url) as DashboardResponse;
  if (!payload || !Array.isArray(payload.machines) || !Array.isArray(payload.history)
    || !payload.machines.every(isRecord) || !payload.history.every(isRecord)
    || (payload.refreshedAt !== null && (typeof payload.refreshedAt !== 'string' || timestamp(payload.refreshedAt) === null))) {
    throw new Error('Dashboard returned invalid data.');
  }
  const usage = observedHours(payload.history, dates);
  const machines = payload.machines.map((row): Machine => ({
    id: row.bluetooth_address,
    dorm: machineDorm(row.machine_name, row.location_name),
    machineName: row.machine_name || row.bluetooth_address,
    machineType: row.machine_type || 'Unknown',
    status: row.status || 'Unknown',
    progress: null,
    minutesLeft: null,
    estimatedComplete: false,
    usageHoursPastWeek: usage.get(row.bluetooth_address) ?? null,
    topOffAvailable: row.top_off_available === 1,
    pollTime: row.poll_time,
    estimatedCompletionTime: timestamp(row.estimated_completion_time) === null ? null : row.estimated_completion_time,
  }));
  const typeOrder = (type: string) => type === 'Washer' ? 0 : type === 'Dryer' ? 1 : 2;
  machines.sort((a, b) => typeOrder(a.machineType) - typeOrder(b.machineType)
    || a.machineType.localeCompare(b.machineType)
    || a.machineName.localeCompare(b.machineName, undefined, { numeric: true })
    || a.id.localeCompare(b.id));
  return {
    machines: deriveMachines(machines, now.getTime()),
    history: payload.history,
    refreshedAt: payload.refreshedAt === null ? null : new Date(payload.refreshedAt),
    dates,
  };
}

export async function refreshSnapshot(now?: Date): Promise<Snapshot> {
  const result = await requestJson(new URL('/v1/scrape', apiBase)) as { ok?: boolean } | null;
  if (result?.ok !== true) throw new Error('Refresh did not complete successfully.');
  return loadSnapshot(now);
}

export function deriveMachines(machines: Machine[], now: number): Machine[] {
  return machines.map(machine => {
    const eta = timestamp(machine.estimatedCompletionTime);
    const poll = timestamp(machine.pollTime);
    const running = machine.status === 'Running' && eta !== null && Number.isFinite(now);
    return {
      ...machine,
      estimatedCompletionTime: eta === null ? null : machine.estimatedCompletionTime,
      minutesLeft: running ? Math.max(0, Math.ceil((eta - now) / minute)) : null,
      estimatedComplete: running && now >= eta,
      // The upstream data has no cycle start. Show only time elapsed since its poll.
      progress: running && poll !== null && eta > poll ? Math.min(1, Math.max(0, (now - poll) / (eta - poll))) : null,
    };
  });
}

export function filterMachines(machines: Machine[], dorm: string): Machine[] {
  return dorm === 'All Dorms' ? machines : machines.filter(machine => machine.dorm === dorm);
}

export function summary(machines: Machine[], type: MachineType) {
  const typed = machines.filter(machine => machine.machineType === type);
  const active = typed.filter(machine => machine.status === 'Running' && !machine.estimatedComplete && machine.minutesLeft !== null);
  return {
    total: typed.length,
    available: typed.filter(machine => machine.status === 'Available' || machine.status === 'Completed' || machine.estimatedComplete).length,
    next: active.sort((a, b) => a.minutesLeft! - b.minutesLeft!).at(0),
  };
}

export function usageRank(machine: Machine, machines: Machine[]): { rank: number; total: number } | null {
  if (machine.usageHoursPastWeek === null) return null;
  const ranked = machines.filter(item => item.machineType === machine.machineType && item.usageHoursPastWeek !== null)
    .sort((a, b) => b.usageHoursPastWeek! - a.usageHoursPastWeek! || a.machineName.localeCompare(b.machineName, undefined, { numeric: true }));
  const index = ranked.findIndex(item => item.id === machine.id);
  return index < 0 ? null : { rank: index + 1, total: ranked.length };
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

// Average the recorded running count at each observed poll. A type with no samples
// in a bucket stays null; zero means that type was observed without running machines.
function recordedUsage(machines: Machine[], history: MachineSnapshot[], labels: string[], bucket: (date: Date) => number): UsagePoint[] {
  const selected = new Map(machines.map(machine => [machine.id, machine.machineType]));
  const samples = labels.map(() => ({ washers: new Map<number, number>(), dryers: new Map<number, number>() }));
  for (const row of history) {
    const type = selected.get(row.bluetooth_address);
    if (type !== 'Washer' && type !== 'Dryer') continue;
    const time = timestamp(row.poll_time);
    if (time === null) continue;
    const index = bucket(new Date(time));
    if (index < 0 || index >= labels.length) continue;
    const counts = samples[index][type === 'Washer' ? 'washers' : 'dryers'];
    counts.set(time, (counts.get(time) ?? 0) + (row.status === 'Running' ? 1 : 0));
  }
  const average = (counts: Map<number, number>) => counts.size ? [...counts.values()].reduce((sum, count) => sum + count, 0) / counts.size : null;
  return labels.map((label, index) => ({ label, washers: average(samples[index].washers), dryers: average(samples[index].dryers) }));
}

export function dailyUsage(machines: Machine[], history: MachineSnapshot[], date: Date): UsagePoint[] {
  const labels = Array.from({ length: 24 }, (_, hour) => `${hour.toString().padStart(2, '0')}:00`);
  const selectedDate = dateKey(date);
  return recordedUsage(machines, history, labels, poll => dateKey(poll) === selectedDate ? poll.getHours() : -1);
}

export function weeklyUsage(machines: Machine[], history: MachineSnapshot[], dates: Date[]): UsagePoint[] {
  const selectedDates = dates.map(dateKey);
  return recordedUsage(machines, history, dates.map(date => days[(date.getDay() + 6) % 7]), poll => selectedDates.indexOf(dateKey(poll)));
}
