import type { Env } from './env';
import type { GreenwaldMachine } from './types';

function isMachine(value: unknown): value is GreenwaldMachine {
  if (typeof value !== 'object' || value === null) return false;
  const machine = value as Record<string, unknown>;
  return typeof machine.bluetoothAddress === 'string' && machine.bluetoothAddress.length > 0
    && ['machineName', 'locationName', 'status', 'platformType', 'estimatedCompletionTime', 'machineType']
      .every((field) => typeof machine[field] === 'string')
    && ['topOffAvailable', 'multiTopOffAvailable', 'superCycleAvailable']
      .every((field) => typeof machine[field] === 'boolean')
    && ['topOffCost', 'minutesPerTopOff']
      .every((field) => machine[field] === null || (typeof machine[field] === 'number' && Number.isFinite(machine[field])));
}

/** Fetch the Greenwald room-view endpoint and return parsed JSON */
export async function fetchGreenwaldRoomView(env: Env): Promise<GreenwaldMachine[]> {
  const url = 'https://gpay.gi-web.net/api/v2/room-view';
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': env.GREENWALD_AUTHKEY,
      'Cookie': env.GREENWALD_COOKIE,
      'User-Agent': env.GREENWALD_UA,
    },
  });
  if (!response.ok) {
    throw Object.assign(new Error(`Greenwald fetch failed with ${response.status}`), { response });
  }
  const data: unknown = await response.json();
  if (!Array.isArray(data) || data.length === 0 || !data.every(isMachine)) {
    throw Object.assign(new Error('Greenwald returned invalid machine data.'), { response });
  }
  return data;
}
