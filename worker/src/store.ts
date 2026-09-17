import type { Env } from './env';
import type { MachineSnapshot } from './types';

/** Insert or replace snapshots in chunks (max 50 per batch for safety) */
export async function insertSnapshots(env: Env, rows: MachineSnapshot[]): Promise<void> {
  const db = env.DB;
  const chunkSize = 50;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const statements: string[] = [];
    const params: unknown[] = [];
    for (const r of chunk) {
      statements.push(`INSERT OR REPLACE INTO machine_snapshots (
        bluetooth_address, poll_time, machine_name, location_name, status,
        platform_type, machine_type, estimated_completion_time,
        top_off_available, multi_top_off_available, super_cycle_available,
        top_off_cost, minutes_per_top_off
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`);
      params.push(
        r.bluetooth_address,
        r.poll_time,
        r.machine_name,
        r.location_name,
        r.status,
        r.platform_type,
        r.machine_type,
        r.estimated_completion_time,
        r.top_off_available,
        r.multi_top_off_available,
        r.super_cycle_available,
        r.top_off_cost,
        r.minutes_per_top_off,
      );
    }
    await db.batch(statements.map((sql, idx) => db.prepare(sql).bind(...params.slice(idx * 13, (idx + 1) * 13))));
  }
}