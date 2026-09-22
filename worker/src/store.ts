import type { Env } from './env';
import type { DashboardData, MachineSnapshot } from './types';

/** A poll is one transaction so readers never see a partially saved snapshot. */
export async function insertSnapshots(env: Env, rows: MachineSnapshot[]): Promise<void> {
  if (rows.length === 0) return;
  const statement = env.DB.prepare(`INSERT OR REPLACE INTO machine_snapshots (
    bluetooth_address, poll_time, machine_name, location_name, status,
    platform_type, machine_type, estimated_completion_time,
    top_off_available, multi_top_off_available, super_cycle_available,
    top_off_cost, minutes_per_top_off
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  await env.DB.batch(rows.map((row) => statement.bind(
    row.bluetooth_address,
    row.poll_time,
    row.machine_name,
    row.location_name,
    row.status,
    row.platform_type,
    row.machine_type,
    row.estimated_completion_time,
    row.top_off_available,
    row.multi_top_off_available,
    row.super_cycle_available,
    row.top_off_cost,
    row.minutes_per_top_off,
  )));
}

/** Read both views from D1; this path never calls the upstream service. */
export async function readDashboard(env: Env, start: string, end: string): Promise<DashboardData> {
  const [latest, history] = await env.DB.batch<MachineSnapshot>([
    env.DB.prepare(`SELECT * FROM machine_snapshots
      WHERE poll_time = (SELECT MAX(poll_time) FROM machine_snapshots)
      ORDER BY bluetooth_address`),
    env.DB.prepare(`SELECT * FROM machine_snapshots
      WHERE poll_time >= ? AND poll_time < ?
      ORDER BY poll_time, bluetooth_address`).bind(start, end),
  ]);
  return {
    machines: latest.results,
    history: history.results,
    refreshedAt: latest.results[0]?.poll_time ?? null,
  };
}
