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

export interface UsagePoint {
  // Bucket start. For week view: YYYY-MM-DD 00:00 local.
  // For day view: YYYY-MM-DD HH:00 local.
  bucket: string;
  washer: number;
  dryer: number;
}

export interface UsageSeries {
  dormId: DormId;
  // 7 daily buckets, most recent day last.
  week: UsagePoint[];
  // 7 * 24 hourly buckets for the trailing week.
  hourly: UsagePoint[];
}

export interface DashboardSnapshot {
  dorm: Dorm;
  dorms: Dorm[];
  machines: Machine[];
  usage: UsageSeries;
  generatedAt: string;
}
