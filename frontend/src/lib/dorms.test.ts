import { expect, test } from 'bun:test';
import { machineDorm } from './dorms';

test('assigns Alamo machines W5 through W7 and D5 through D7', () => {
  for (const machine of ['W5', 'W6', 'W7', 'D5', 'D6', 'D7']) {
    expect(machineDorm(machine, null)).toBe('Alamo');
  }
});
