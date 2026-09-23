import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { MachineSnapshot } from '../../../worker/src/types';
import * as data from './data';
import type { Machine } from './data';

const originalFetch = globalThis.fetch;
const now = new Date(2026, 8, 21, 12);
const pollTime = '2026-09-21T18:00:00.000Z';

function stubFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  const request = Object.assign(mock(handler), { preconnect: originalFetch.preconnect });
  globalThis.fetch = request;
  return request;
}

function record(overrides: Partial<MachineSnapshot> = {}): MachineSnapshot {
  return {
    bluetooth_address: 'washer-1', poll_time: pollTime, machine_name: 'W1',
    location_name: 'Raw location 42', status: 'Running', platform_type: null,
    machine_type: 'Washer', estimated_completion_time: '2026-09-21T18:30:00.000Z',
    top_off_available: 0, multi_top_off_available: 0, super_cycle_available: 0,
    top_off_cost: null, minutes_per_top_off: null, ...overrides,
  };
}

function machine(overrides: Partial<Machine> = {}): Machine {
  return {
    id: 'washer-1', dorm: 'Raw location 42', machineName: 'W1', machineType: 'Washer',
    status: 'Running', progress: null, minutesLeft: null, estimatedComplete: false,
    usageHoursPastWeek: null, topOffAvailable: false, pollTime,
    estimatedCompletionTime: '2026-09-21T18:30:00.000Z', ...overrides,
  };
}

function respond(machines = [record()], history: MachineSnapshot[] = [], refreshedAt: string | null = pollTime) {
  return Response.json({ machines, history, refreshedAt });
}

afterEach(() => { globalThis.fetch = originalFetch; });

describe('stored dashboard requests', () => {
  test('ordinary loading only reads dashboard and retains the database timestamp and identities', async () => {
    const requests: URL[] = [];
    stubFetch(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new URL(String(input)));
      expect(init?.method ?? 'GET').toBe('GET');
      return respond();
    });
    const snapshot = await data.loadSnapshot(now);
    expect(requests).toHaveLength(1);
    expect(requests[0].origin).toBe('https://api.spinsight.xyz');
    expect(requests[0].pathname).toBe('/v1/dashboard');
    expect(requests[0].searchParams.get('start')).toBe(new Date(2026, 8, 14).toISOString());
    expect(requests[0].searchParams.get('end')).toBe(new Date(new Date(2026, 8, 21).getTime() + 1).toISOString());
    expect(snapshot.dates.map(date => date.getDate())).toEqual([14, 15, 16, 17, 18, 19, 20]);
    expect(snapshot.refreshedAt?.toISOString()).toBe(pollTime);
    expect(snapshot.machines).toHaveLength(1);
    expect(snapshot.machines[0]).toMatchObject({ id: 'washer-1', dorm: 'Alamo', machineName: 'W1', usageHoursPastWeek: null });
  });

  test('empty database stays empty and has no fabricated freshness', async () => {
    stubFetch(async () => respond([], [], null));
    expect(await data.loadSnapshot(now)).toMatchObject({ machines: [], history: [], refreshedAt: null });
  });

  test('maps both machine types numbered 8 through 12 to Upper Dorms', async () => {
    const records = ['Washer', 'Dryer'].flatMap(machine_type => Array.from({ length: 21 }, (_, index) => {
      const machine_name = `${machine_type === 'Washer' ? 'W' : 'D'}${index + 1}`;
      return record({ bluetooth_address: machine_name, machine_name, machine_type });
    }));
    stubFetch(async () => respond(records));
    const snapshot = await data.loadSnapshot(now);
    const upper = data.filterMachines(snapshot.machines, 'Upper Dorms');
    expect(upper.map(machine => machine.machineName)).toEqual(['W8', 'W9', 'W10', 'W11', 'W12', 'D8', 'D9', 'D10', 'D11', 'D12']);
    expect(new Set(snapshot.machines.map(machine => machine.dorm)).size).toBe(7);
    for (const dorm of ['Alamo', 'North Hutch', 'South Hutch', 'Appleby', 'Jones', 'Jameson']) {
      const assigned = data.filterMachines(snapshot.machines, dorm);
      expect(assigned.length).toBeGreaterThanOrEqual(4);
      expect(assigned.length).toBeLessThanOrEqual(6);
      expect(assigned.filter(machine => machine.machineType === 'Washer').length).toBe(assigned.length / 2);
    }
    expect(records.every(row => row.location_name === 'Raw location 42')).toBe(true);
  });

  test('keeps database locations for machine names outside the temporary mapping', async () => {
    stubFetch(async () => respond([
      record({ bluetooth_address: 'new-machine', machine_name: 'W22' }),
      record({ bluetooth_address: 'other-name', machine_name: 'Washer 8' }),
    ]));
    expect((await data.loadSnapshot(now)).machines.every(machine => machine.dorm === 'Raw location 42')).toBe(true);
  });

  test('orders washers then dryers with natural machine names', async () => {
    stubFetch(async () => respond([
      record({ bluetooth_address: 'dryer', machine_type: 'Dryer', machine_name: 'D1' }),
      record({ bluetooth_address: 'ten', machine_name: 'W10' }),
      record({ bluetooth_address: 'two', machine_name: 'W2' }),
      record({ bluetooth_address: 'one', machine_name: 'W1' }),
    ]));
    expect((await data.loadSnapshot(now)).machines.map(machine => machine.machineName)).toEqual(['W1', 'W2', 'W10', 'D1']);
  });

  test('preserves raw machine states and marks absent names and location honestly', async () => {
    stubFetch(async () => respond([record({ machine_name: null, location_name: null, status: 'Offline', machine_type: null, estimated_completion_time: 'invalid' })]));
    const snapshot = await data.loadSnapshot(now);
    expect(snapshot.machines[0]).toMatchObject({ machineName: 'washer-1', dorm: 'Unknown location', status: 'Offline', machineType: 'Unknown', estimatedCompletionTime: null });
  });

  test('refresh waits for scrape completion before reading the committed dashboard', async () => {
    expect(typeof data.refreshSnapshot).toBe('function');
    let finishScrape!: (response: Response) => void;
    const scrape = new Promise<Response>(resolve => { finishScrape = resolve; });
    const requests: string[] = [];
    stubFetch(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      requests.push(path);
      return path === '/v1/scrape' ? scrape : respond();
    });
    const loading = data.refreshSnapshot(now);
    await Promise.resolve();
    expect(requests).toEqual(['/v1/scrape']);
    finishScrape(Response.json({ ok: true, pollTime, count: 1 }));
    const snapshot = await loading;
    expect(requests).toEqual(['/v1/scrape', '/v1/dashboard']);
    expect(snapshot.refreshedAt?.toISOString()).toBe(pollTime);
  });

  test('scrape HTTP failures prevent a subsequent dashboard request', async () => {
    expect(typeof data.refreshSnapshot).toBe('function');
    const request = stubFetch(async () => Response.json({ error: { code: 'refresh_failed', message: 'Upstream unavailable' } }, { status: 502 }));
    await expect(data.refreshSnapshot(now)).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(1);
  });

  test('scrape requires an affirmative success response', async () => {
    expect(typeof data.refreshSnapshot).toBe('function');
    const request = stubFetch(async () => Response.json({ ok: false }));
    await expect(data.refreshSnapshot(now)).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(1);
  });

  test('dashboard HTTP and network failures reject without demo data', async () => {
    stubFetch(async () => new Response('Unavailable', { status: 503 }));
    await expect(data.loadSnapshot(now)).rejects.toThrow();
    stubFetch(async () => { throw new Error('Offline'); });
    await expect(data.loadSnapshot(now)).rejects.toThrow('Offline');
  });

  test('malformed dashboard data is an error rather than an empty or generated dashboard', async () => {
    stubFetch(async () => Response.json({ machines: 'unexpected', history: [], refreshedAt: pollTime }));
    await expect(data.loadSnapshot(now)).rejects.toThrow();
    stubFetch(async () => respond([], [], 'not a timestamp'));
    await expect(data.loadSnapshot(now)).rejects.toThrow();
  });
});

describe('local countdown derivation', () => {
  test('uses poll and completion instants for elapsed estimate with no network traffic', () => {
    expect(typeof data.deriveMachines).toBe('function');
    const request = stubFetch(() => { throw new Error('Countdown must stay local'); });
    const stored = machine();
    expect(data.deriveMachines([stored], Date.parse('2026-09-21T18:15:00Z'))[0]).toMatchObject({ minutesLeft: 15, progress: 0.5, estimatedComplete: false, status: 'Running' });
    expect(data.deriveMachines([stored], Date.parse('2026-09-21T18:30:00Z'))[0]).toMatchObject({ minutesLeft: 0, progress: 1, estimatedComplete: true, status: 'Running' });
    expect(stored.minutesLeft).toBeNull();
    expect(request).not.toHaveBeenCalled();
  });

  test('ETA can cross local midnight and carries its own timezone offset', () => {
    expect(typeof data.deriveMachines).toBe('function');
    const stored = machine({ pollTime: '2026-09-20T23:50:00-07:00', estimatedCompletionTime: '2026-09-21T00:20:00-07:00' });
    expect(data.deriveMachines([stored], Date.parse('2026-09-21T07:05:00Z'))[0]).toMatchObject({ minutesLeft: 15, progress: 0.5, estimatedComplete: false });
  });

  test('missing and invalid ETAs stay unknown and non-running states never become estimated completions', () => {
    expect(typeof data.deriveMachines).toBe('function');
    for (const estimatedCompletionTime of [null, '', 'invalid']) {
      expect(data.deriveMachines([machine({ estimatedCompletionTime })], now.getTime())[0]).toMatchObject({ minutesLeft: null, progress: null, estimatedComplete: false });
    }
    for (const status of ['Offline', 'Unknown', 'Available', 'Completed']) {
      expect(data.deriveMachines([machine({ status })], Date.parse('2026-09-21T19:00:00Z'))[0]).toMatchObject({ progress: null, minutesLeft: null, estimatedComplete: false, status });
    }
  });

  test('invalid poll intervals do not fabricate elapsed progress', () => {
    expect(typeof data.deriveMachines).toBe('function');
    expect(data.deriveMachines([machine({ pollTime: 'invalid' })], Date.parse('2026-09-21T18:15:00Z'))[0]).toMatchObject({ minutesLeft: 15, progress: null });
    expect(data.deriveMachines([machine({ pollTime: '2026-09-21T18:40:00Z' })], Date.parse('2026-09-21T18:15:00Z'))[0]).toMatchObject({ minutesLeft: 15, progress: null });
    expect(data.deriveMachines([machine()], Date.parse('2026-09-21T17:59:00Z'))[0].progress).toBe(0);
  });

  test('availability excludes unknown and offline states and next completion needs a valid active ETA', () => {
    const machines = [
      machine({ id: 'available', status: 'Available' }), machine({ id: 'completed', status: 'Completed' }),
      machine({ id: 'elapsed', estimatedComplete: true, minutesLeft: 0 }), machine({ id: 'offline', status: 'Offline' }),
      machine({ id: 'unknown', status: 'Unknown' }), machine({ id: 'missing-eta' }),
      machine({ id: 'next', minutesLeft: 3 }), machine({ id: 'later', minutesLeft: 10 }),
    ];
    expect(data.summary(machines, 'Washer')).toMatchObject({ total: 8, available: 3, next: { id: 'next' } });
    expect(data.summary([], 'Dryer')).toEqual({ total: 0, available: 0, next: undefined });
  });

  test('rank omits missing history and stays within selected dorm and machine type', () => {
    const machines = [machine({ id: 'one', usageHoursPastWeek: 1 }), machine({ id: 'two', usageHoursPastWeek: 2 }), machine({ id: 'none' }), machine({ id: 'dryer', machineType: 'Dryer', usageHoursPastWeek: 3 }), machine({ id: 'other', dorm: 'Another dorm', usageHoursPastWeek: 4 })];
    const selected = data.filterMachines(machines, 'Raw location 42');
    expect(data.usageRank(machines[0], selected)).toEqual({ rank: 2, total: 2 });
    expect(data.usageRank(machines[2], selected)).toBeNull();
    expect(data.usageRank(machines[4], selected)).toBeNull();
    expect(data.filterMachines(machines, 'All Dorms')).toEqual(machines);
  });
});

describe('recorded history', () => {
  const date = new Date(2026, 8, 14);
  const localTime = (day: number, hour: number, minute = 0) => new Date(2026, 8, day, hour, minute).toISOString();
  const machines = [machine(), machine({ id: 'washer-2', dorm: 'Another dorm' }), machine({ id: 'dryer-1', machineType: 'Dryer' })];

  test('database polls count running machines and preserve missing machine types as null', () => {
    const history = [
      record({ poll_time: localTime(14, 1), status: 'Running' }),
      record({ bluetooth_address: 'washer-2', poll_time: localTime(14, 1), status: 'Running' }),
      record({ poll_time: localTime(14, 1, 30), status: 'Available' }),
      record({ bluetooth_address: 'washer-2', poll_time: localTime(14, 1, 30), status: 'Running' }),
      record({ poll_time: localTime(14, 2), status: 'Available' }),
      record({ bluetooth_address: 'dryer-1', machine_type: 'Dryer', poll_time: localTime(14, 2), status: 'Available' }),
      record({ bluetooth_address: 'unselected', poll_time: localTime(14, 1), status: 'Running' }),
    ];
    const daily = data.dailyUsage(machines, history, date);
    expect(daily).toEqual([
      { label: '01:00', timestamp: Date.parse(localTime(14, 1)), washers: 2, dryers: null },
      { label: '01:30', timestamp: Date.parse(localTime(14, 1, 30)), washers: 1, dryers: null },
      { label: '02:00', timestamp: Date.parse(localTime(14, 2)), washers: 0, dryers: 0 },
    ]);
    const weekly = data.weeklyUsage(machines, history, data.lastFullWeek(now));
    expect(weekly).toHaveLength(7);
    expect(weekly[0]).toMatchObject({ label: 'Mon', washers: 2, dryers: 0 });
    expect(weekly.slice(1).every(point => point.washers === null && point.dryers === null)).toBe(true);
    const selected = data.filterMachines(machines, 'Raw location 42');
    expect(data.dailyUsage(selected, history, date)[0].washers).toBe(1);
  });

  test('week view takes each type’s daily peak from recorded polls', () => {
    const history = [
      record({ poll_time: localTime(14, 9), status: 'Running' }),
      record({ bluetooth_address: 'washer-2', poll_time: localTime(14, 9), status: 'Running' }),
      record({ bluetooth_address: 'dryer-1', machine_type: 'Dryer', poll_time: localTime(14, 9), status: 'Available' }),
      record({ poll_time: localTime(14, 18), status: 'Available' }),
      record({ bluetooth_address: 'washer-2', poll_time: localTime(14, 18), status: 'Available' }),
      record({ bluetooth_address: 'dryer-1', machine_type: 'Dryer', poll_time: localTime(14, 18), status: 'Running' }),
      record({ poll_time: localTime(15, 9), status: 'Available' }),
      record({ poll_time: localTime(13, 23, 59), status: 'Running' }),
      record({ poll_time: localTime(21, 0), status: 'Running' }),
    ];

    const weekly = data.weeklyUsage(machines, history, data.lastFullWeek(now));
    expect(weekly.map(point => [point.washers, point.dryers])).toEqual([
      [2, 1], [0, null], [null, null], [null, null], [null, null], [null, null], [1, null],
    ]);
    expect(weekly[0].timestamp).toBe(Date.parse(localTime(14, 12)));
    expect(weekly[1].label).toBe('Tue');
  });

  test('plots every database poll timestamp without assuming a polling interval', () => {
    const history = [
      record({ poll_time: localTime(14, 0, 7), status: 'Running' }),
      record({ bluetooth_address: 'washer-2', poll_time: localTime(14, 0, 7), status: 'Available' }),
      record({ bluetooth_address: 'dryer-1', machine_type: 'Dryer', poll_time: localTime(14, 0, 7), status: 'Available' }),
      record({ poll_time: localTime(14, 0, 42), status: 'Available' }),
      record({ bluetooth_address: 'washer-2', poll_time: localTime(14, 0, 42), status: 'Running' }),
      record({ bluetooth_address: 'dryer-1', machine_type: 'Dryer', poll_time: localTime(14, 0, 42), status: 'Running' }),
      record({ poll_time: localTime(14, 1, 19), status: 'Running' }),
      record({ bluetooth_address: 'washer-2', poll_time: localTime(14, 1, 19), status: 'Running' }),
      record({ bluetooth_address: 'dryer-1', machine_type: 'Dryer', poll_time: localTime(14, 1, 19), status: 'Available' }),
    ];

    expect(data.dailyUsage(machines, history, date)).toEqual([
      { label: '00:07', timestamp: Date.parse(localTime(14, 0, 7)), washers: 1, dryers: 0 },
      { label: '00:42', timestamp: Date.parse(localTime(14, 0, 42)), washers: 1, dryers: 1 },
      { label: '01:19', timestamp: Date.parse(localTime(14, 1, 19)), washers: 2, dryers: 0 },
    ]);
  });

  test('copies next midnight as 24:00 while retaining it as the next day’s 00:00', () => {
    const history = [record({ poll_time: localTime(13, 23, 59) }), record({ poll_time: localTime(14, 0) }), record({ poll_time: localTime(14, 23, 59) }), record({ poll_time: localTime(15, 0) })];
    const daily = data.dailyUsage(machines, history, date);
    expect(daily.map(point => point.label)).toEqual(['00:00', '23:59', '24:00']);
    const nextDay = data.dailyUsage(machines, history, new Date(2026, 8, 15));
    expect(nextDay).toEqual([{ ...daily[2], label: '00:00' }]);
    expect(daily[2]).toMatchObject({ timestamp: Date.parse(localTime(15, 0)), washers: 1, dryers: null });
    expect(history).toHaveLength(4);
    expect(daily[0].washers).toBe(1);
    expect(daily[1].washers).toBe(1);
    expect(data.dailyUsage([], history, date).every(point => point.washers === null && point.dryers === null)).toBe(true);
  });

  test('weekly peaks include midnight in both adjacent days', () => {
    const history = [record({ poll_time: localTime(15, 0) })];
    expect(data.weeklyUsage(machines, history, data.lastFullWeek(now)).slice(0, 2)
      .map(point => point.washers)).toEqual([1, 1]);
  });

  test('does not substitute a later reading for a missing midnight, including calendar and DST boundaries', () => {
    for (const date of [new Date(2026, 8, 14), new Date(2026, 11, 31), new Date(2026, 2, 8), new Date(2026, 10, 1)]) {
      const midnight = new Date(date);
      midnight.setDate(midnight.getDate() + 1);
      const history = [record({ poll_time: new Date(midnight.getTime() + 1).toISOString() })];
      expect(data.dailyUsage(machines, history, date)).toEqual([]);
      history.push(record({ poll_time: midnight.toISOString(), status: 'Available' }));
      expect(data.dailyUsage(machines, history, date)).toEqual([
        { label: '24:00', timestamp: midnight.getTime(), washers: 0, dryers: null },
      ]);
    }
  });

  test('observed hours stop at the next poll or ETA and cap missing gaps at 30 minutes', async () => {
    const history = [
      record({ poll_time: localTime(14, 0), estimated_completion_time: localTime(14, 2) }),
      record({ poll_time: localTime(14, 0, 15), status: 'Available' }),
      record({ poll_time: localTime(14, 1), estimated_completion_time: localTime(14, 1, 10) }),
      record({ poll_time: localTime(14, 3), estimated_completion_time: null }),
      record({ poll_time: localTime(20, 23, 50), estimated_completion_time: localTime(21, 1) }),
      record({ poll_time: localTime(21, 2), estimated_completion_time: localTime(21, 3) }),
    ];
    stubFetch(async () => respond([record(), record({ bluetooth_address: 'no-history' })], history));
    const snapshot = await data.loadSnapshot(now);
    expect(snapshot.machines.find(machine => machine.id === 'washer-1')?.usageHoursPastWeek).toBeCloseTo(65 / 60, 8);
    expect(snapshot.machines.find(machine => machine.id === 'no-history')?.usageHoursPastWeek).toBeNull();
  });

  test('last full week uses local Monday through Sunday across year and DST boundaries', () => {
    for (const date of [new Date(2026, 8, 21), new Date(2026, 8, 27), new Date(2026, 0, 1), new Date(2026, 2, 9), new Date(2026, 10, 2)]) {
      const week = data.lastFullWeek(date);
      expect(week).toHaveLength(7);
      expect(week[0].getDay()).toBe(1);
      expect(week[6].getDay()).toBe(0);
      expect(week[6].getTime()).toBeLessThan(date.getTime());
      expect(week.every(day => day.getHours() === 0)).toBe(true);
    }
    expect(data.lastFullWeek(new Date(2026, 8, 21))[0].getDate()).toBe(14);
    expect(data.lastFullWeek(new Date(2026, 8, 27))[6].getDate()).toBe(20);
  });

  test('weekly chart bounds always span the full Monday through Sunday week', () => {
    const dates = data.lastFullWeek(new Date(2026, 8, 21));
    const weeklyChartBounds = (data as typeof data & {
      weeklyChartBounds: (dates: Date[]) => { start: number; end: number };
    }).weeklyChartBounds;
    const bounds = weeklyChartBounds(dates);
    const nextMonday = new Date(dates[6]);
    nextMonday.setDate(nextMonday.getDate() + 1);

    expect(bounds).toEqual({ start: dates[0].getTime(), end: nextMonday.getTime() });
  });
});
