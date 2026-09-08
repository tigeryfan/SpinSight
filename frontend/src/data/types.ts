// Domain types for SpinSight.
// Shapes match what a backend would return, so the data layer can swap
// from mock to real fetch without touching components.

export type DormId = string;

export type MachineKind = "washer" | "dryer";

export type MachineStatus =
  | "available"
  | "running"
  | "almost_done"
  | "out_of_order";

export interface Dorm {
  id: DormId;
  name: string;
}

export interface Machine {
  id: string;
  dormId: DormId;
  kind: MachineKind;
  label: string;
  status: MachineStatus;
  // Cycle duration in minutes (only meaningful when status is running or almost_done)
  cycleMinutes: number;
  // Elapsed minutes within the current cycle (0 when available)
  elapsedMinutes: number;
  // Estimated minutes until free (0 when available)
  etaMinutes: number;
}

// One observation: how many machines of each kind are in use at a moment.
// Mirrors what the SQLite store holds aggregated per poll: per-machine rows
// roll up into a single (dorm, timestamp) count here. The backend route
// `fetchObservations` will eventually return these from the store; the mock
// synthesizes them so the frontend runs without a backend.
export interface UsageObservation {
  // ISO 8601 timestamp, e.g. "2026-09-08T14:30:00".
  timestamp: string;
  dormId: DormId;
  // Count of washers in use at this timestamp (status running or almost_done).
  washer: number;
  // Count of dryers in use at this timestamp.
  dryer: number;
}

export interface UsagePoint {
  // Bucket start. For weekdayDaily: YYYY-MM-DD of the most recent occurrence.
  // For weekdayHalfHour: YYYY-MM-DDTHH:00 or YYYY-MM-DDTHH:30.
  bucket: string;
  washer: number;
  dryer: number;
}

// Pre-averaged usage. The averaging module in ./averages.ts turns raw
// observations into this shape so the chart never has to compute.
export interface AveragedUsage {
  dormId: DormId;
  // 7 weekday buckets, Mon..Sun. Each is the mean of every observation that
  // landed on that weekday. Drives the 7d chart.
  weekdayDaily: UsagePoint[];
  // 7 arrays of 48 buckets each, indexed by weekday (0=Mon..6=Sun). Each
  // bucket is the mean of observations in that 30-min slot on that weekday.
  // Drives the day chart.
  weekdayHalfHour: UsagePoint[][];
}

export interface DashboardSnapshot {
  dorm: Dorm;
  dorms: Dorm[];
  machines: Machine[];
  usage: AveragedUsage;
  generatedAt: string;
}
