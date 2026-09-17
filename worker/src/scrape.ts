import type { Env } from './env';
import { fetchGreenwaldRoomView } from './upstream';
import { insertSnapshots } from './store';
import type { GreenwaldMachine, MachineSnapshot } from './types';
import { withRetry, RetryExhaustedError, RetryOpts } from './retry';

/** Convert raw machine to snapshot */
function toMachineSnapshot(raw: GreenwaldMachine, pollTime: string): MachineSnapshot {
  return {
    bluetooth_address: raw.bluetoothAddress,
    poll_time: pollTime,
    machine_name: raw.machineName,
    location_name: raw.locationName,
    status: raw.status,
    platform_type: raw.platformType,
    machine_type: raw.machineType,
    estimated_completion_time: raw.estimatedCompletionTime,
    top_off_available: raw.topOffAvailable ? 1 : 0,
    multi_top_off_available: raw.multiTopOffAvailable ? 1 : 0,
    super_cycle_available: raw.superCycleAvailable ? 1 : 0,
    top_off_cost: raw.topOffCost,
    minutes_per_top_off: raw.minutesPerTopOff,
  };
}

/** Core scrape logic */
export async function runScrape(env: Env): Promise<void> {
  const pollTime = new Date().toISOString();
  const retryOpts: RetryOpts = {
    maxAttempts: 5,
    baseDelayMs: 1000,
    maxDelayMs: 60000,
    jitter: 'full',
    isRetryable: (err, res) => {
      if (res) {
        if (res.status === 429) return true;
        if (res.status >= 500) return true;
        return false;
      }
      // Network or other errors are retryable
      return true;
    },
    onRetry: (info) => {
      console.warn(`Retry attempt ${info.attempt} after ${info.delayMs}ms: ${info.reason}`);
    },
  };

  let machines: GreenwaldMachine[];
  try {
    machines = await withRetry(() => fetchGreenwaldRoomView(env), retryOpts);
  } catch (e) {
    if (e instanceof RetryExhaustedError) {
      console.error('Scrape failed after retries:', e.lastError);
    } else {
      console.error('Unexpected error during scrape:', e);
    }
    return; // nothing to store
  }

  const snapshots = machines.map((m) => toMachineSnapshot(m, pollTime));
  await insertSnapshots(env, snapshots);
  console.info(`Scrape completed ${pollTime}: fetched ${machines.length}, inserted ${snapshots.length}`);
}