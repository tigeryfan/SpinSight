import type { Dorm, WeeklyUsage } from './types';
import { generateDorms, generateWeeklyUsage } from './mock';

/**
 * Today: synchronous mock data. Swap these bodies for fetch() calls when
 * the Worker backend exposes dorms and weekly usage endpoints.
 */
export function loadDorms(seed: number): Dorm[] {
  return generateDorms(seed);
}

export function loadUsage(seed: number, dormId: string): WeeklyUsage {
  return generateWeeklyUsage(seed, dormId);
}
