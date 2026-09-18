export type MachineType = 'washer' | 'dryer';
export type MachineStatus = 'available' | 'running' | 'done';

export interface Machine {
  id: string;
  type: MachineType;
  status: MachineStatus;
  progress: number;
  remainingMinutes: number;
}

export interface Dorm {
  id: string;
  name: string;
  machines: Machine[];
}

export interface HourUsage {
  hour: number;
  washersInUse: number;
  dryersInUse: number;
}

export interface DailyUsage {
  date: string;
  hours: HourUsage[];
}

export interface DayTotal {
  date: string;
  washersPeak: number;
  dryersPeak: number;
}

export interface WeeklyUsage {
  startDate: string;
  aggregate: DayTotal[];
  days: DailyUsage[];
}
