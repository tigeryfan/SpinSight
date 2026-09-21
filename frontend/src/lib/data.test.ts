import { describe, expect, test } from 'bun:test';
import { createMachines, dailyUsage, dorms, filterMachines, lastFullWeek, summary, usageRank, weeklyUsage } from './data';

const machines = createMachines();
describe('dashboard fixture and summaries', () => {
  test('matches the current mockup and keeps every machine identity unique', () => {
    expect(machines).toHaveLength(42);
    expect(new Set(machines.map(m => m.id)).size).toBe(42);
    expect(summary(machines, 'Washer')).toMatchObject({ available: 20, total: 21, next: { machineName: 'W7', minutesLeft: 23 } });
    expect(summary(machines, 'Dryer')).toMatchObject({ available: 14, total: 21, next: { machineName: 'D18', minutesLeft: 9 } });
  });
  test('filters all seven dorms and scopes rankings and availability', () => {
    for (const dorm of dorms) {
      const filtered = filterMachines(machines, dorm);
      expect(filtered).toHaveLength(6);
      for (const type of ['Washer', 'Dryer'] as const) {
        expect(summary(filtered, type).total).toBe(3);
        expect(filtered.filter(m => m.machineType === type).map(m => usageRank(m, filtered).rank).sort()).toEqual([1, 2, 3]);
      }
    }
    expect(filterMachines(machines, 'All Dorms')).toHaveLength(42);
    expect(summary([], 'Washer')).toEqual({ available: 0, total: 0, next: undefined });
    expect(summary(filterMachines(machines, 'Alamo'), 'Washer').next).toBeUndefined();
  });
});

describe('illustrative history', () => {
  test('every hourly value is bounded by capacity and aggregates across dorms', () => {
    for (let day = 0; day < 7; day++) {
      const all = dailyUsage(machines, day);
      expect(all).toHaveLength(24);
      for (let hour = 0; hour < 24; hour++) {
        for (const key of ['washers', 'dryers'] as const) {
          const total = dorms.reduce((sum, dorm) => {
            const value = dailyUsage(filterMachines(machines, dorm), day)[hour][key];
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(3);
            return sum + value;
          }, 0);
          expect(all[hour][key]).toBe(total);
        }
      }
    }
  });
  test('weekly values summarize the selected day rather than current live state', () => {
    const week = weeklyUsage(machines);
    expect(week).toHaveLength(7);
    week.forEach((point, day) => {
      const hours = dailyUsage(machines, day);
      for (const key of ['washers', 'dryers'] as const) {
        expect(point[key]).toBe(Number((hours.reduce((sum, hour) => sum + hour[key], 0) / 24).toFixed(1)));
      }
    });
    expect(weeklyUsage([]).every(point => point.washers === 0 && point.dryers === 0)).toBe(true);
    expect(dailyUsage(machines, 0)).toEqual(dailyUsage(createMachines(), 0));
  });
  test('last full week stays Monday through Sunday across year and DST boundaries', () => {
    for (const date of [new Date(2026, 8, 21), new Date(2026, 8, 27), new Date(2026, 0, 1), new Date(2026, 2, 9)]) {
      const week = lastFullWeek(date);
      expect(week).toHaveLength(7);
      expect(week[0].getDay()).toBe(1);
      expect(week[6].getDay()).toBe(0);
      expect(week[6].getTime()).toBeLessThan(date.getTime());
    }
    expect(lastFullWeek(new Date(2026, 8, 21))[0].getDate()).toBe(14);
    expect(lastFullWeek(new Date(2026, 8, 27))[6].getDate()).toBe(20);
  });
});
