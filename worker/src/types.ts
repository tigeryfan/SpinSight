/** Raw machine data as returned by Greenwald */
export interface GreenwaldMachine {
  machineName: string;
  locationName: string;
  bluetoothAddress: string;
  status: string;
  platformType: string;
  estimatedCompletionTime: string;
  machineType: string;
  topOffAvailable: boolean;
  multiTopOffAvailable: boolean;
  superCycleAvailable: boolean;
  topOffCost: number | null;
  minutesPerTopOff: number | null;
}

/** Normalized snapshot stored in D1 */
export interface MachineSnapshot {
  bluetooth_address: string;
  poll_time: string; // ISO 8601 UTC
  machine_name: string | null;
  location_name: string | null;
  status: string | null;
  platform_type: string | null;
  machine_type: string | null;
  estimated_completion_time: string | null;
  top_off_available: number;
  multi_top_off_available: number;
  super_cycle_available: number;
  top_off_cost: number | null;
  minutes_per_top_off: number | null;
}

export interface DashboardData {
  machines: MachineSnapshot[];
  history: MachineSnapshot[];
  refreshedAt: string | null;
}

export interface ScrapeResult {
  pollTime: string;
  count: number;
}
