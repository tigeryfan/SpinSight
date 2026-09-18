import type { Dorm, WeeklyUsage } from './types';
import { loadDorms, loadUsage } from './api';

let selectedDormId = $state<string>('mor');
let seed = $state<number>(1);

export function getDorms(): Dorm[] {
  return loadDorms(seed);
}

export function getCurrentDorm(): Dorm | null {
  const list = getDorms();
  return list.find((d) => d.id === selectedDormId) ?? list[0] ?? null;
}

export function getWeeklyUsage(): WeeklyUsage | null {
  const d = getCurrentDorm();
  return d ? loadUsage(seed, d.id) : null;
}

export function getSelectedDormId(): string {
  return selectedDormId;
}

export function setSelectedDormId(id: string): void {
  selectedDormId = id;
}

export function bumpSeed(): void {
  seed = seed + 1;
}

export function getSeed(): number {
  return seed;
}
