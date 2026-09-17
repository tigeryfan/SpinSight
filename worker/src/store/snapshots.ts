/**
 * Single-table persistence for SpinSight.
 *
 * One table — machine_snapshots — receives every scrape. /api/latest, /api/usage,
 * and /api/health all read from it directly with no derived tables to maintain.
 *
 * Conventions:
 *   - INSERT OR REPLACE so re-scrape of the same poll_time is idempotent.
 *   - The 30-minute scrape interval is encoded in two places: the scraper
 *     computes the bucket once, and the usage queries attribute 30 minutes
 *     per snapshot.
 */

import type { Machine } from "../types";

const INSERT_SQL = `
	INSERT OR REPLACE INTO machine_snapshots (
		poll_time, bluetooth_address, machine_name, location_name, status,
		platform_type, estimated_completion_time, machine_type,
		top_off_available, multi_top_off_available, super_cycle_available,
		top_off_cost, minutes_per_top_off
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

export async function insertSnapshots(
	db: D1Database,
	machines: Machine[],
	pollTime: string,
): Promise<void> {
	if (machines.length === 0) return;
	const stmt = db.prepare(INSERT_SQL);
	const batch = machines.map((m) =>
		stmt.bind(
			pollTime,
			m.bluetoothAddress,
			m.machineName,
			m.locationName,
			m.status,
			m.platformType,
			m.estimatedCompletionTime,
			m.machineType,
			m.topOffAvailable ? 1 : 0,
			m.multiTopOffAvailable ? 1 : 0,
			m.superCycleAvailable ? 1 : 0,
			m.topOffCost,
			m.minutesPerTopOff,
		),
	);
	await db.batch(batch);
}

/** Row shape for both raw snapshots and the latest-per-machine result. */
export interface SnapshotRow {
	poll_time: string;
	bluetooth_address: string;
	machine_name: string | null;
	location_name: string | null;
	status: string | null;
	platform_type: string | null;
	estimated_completion_time: string | null;
	machine_type: string | null;
	top_off_available: number;
	multi_top_off_available: number;
	super_cycle_available: number;
	top_off_cost: number | null;
	minutes_per_top_off: number | null;
}

const LATEST_SQL = `
	WITH ranked AS (
		SELECT s.*,
		       ROW_NUMBER() OVER (
		           PARTITION BY bluetooth_address
		           ORDER BY poll_time DESC
		       ) AS rn
		FROM machine_snapshots s
	)
	SELECT
		poll_time, bluetooth_address, machine_name, location_name, status,
		platform_type, estimated_completion_time, machine_type,
		top_off_available, multi_top_off_available, super_cycle_available,
		top_off_cost, minutes_per_top_off
	FROM ranked
	WHERE rn = 1
	ORDER BY machine_type, machine_name
`;

export async function fetchLatest(db: D1Database): Promise<SnapshotRow[]> {
	const { results } = await db.prepare(LATEST_SQL).all<SnapshotRow>();
	return results ?? [];
}

/** Seconds each snapshot represents. Matches the cron interval. */
const SECONDS_PER_SNAPSHOT = 30 * 60;

/**
 * Status expression used in both the daily and hourly usage queries. Lower-cased
 * once so the CASE list stays compact. Add Greenwald casing variants here.
 */
const RUNNING_CASE = `
	CASE
		WHEN LOWER(REPLACE(status, ' ', '_')) IN (
			'running', 'in_use', 'inuse', 'almost_done', 'almostdone'
		) THEN 1 ELSE 0
	END
`;

/**
 * Each snapshot represents the 30 minutes ending at its poll_time, so we
 * attribute it to the day/hour containing the window midpoint (poll_time
 * minus 15 min). Without this offset, a snapshot at HH:00 would land in hour
 * HH when it really describes the half-hour that ended there.
 */
const BUCKET_HOUR_SQL = `substr(datetime(poll_time, '-15 minutes'), 1, 13)`;
const BUCKET_DAY_SQL = `substr(datetime(poll_time, '-15 minutes'), 1, 10)`;

const SEVEN_DAY_USAGE_SQL = `
	SELECT
		${BUCKET_DAY_SQL} AS day,
		COALESCE(machine_type, '') AS machine_type,
		SUM(${RUNNING_CASE}) * ?2 AS running_seconds
	FROM machine_snapshots
	WHERE poll_time >= ?1 AND poll_time < ?3
	GROUP BY day, machine_type
	ORDER BY day
`;

const HOURLY_USAGE_SQL = `
	SELECT
		${BUCKET_HOUR_SQL} AS hour,
		COALESCE(machine_type, '') AS machine_type,
		SUM(${RUNNING_CASE}) * ?2 AS running_seconds
	FROM machine_snapshots
	WHERE poll_time >= ?1 AND poll_time < ?3
	GROUP BY hour, machine_type
	ORDER BY hour
`;

interface UsageRow {
	day?: string;
	hour?: string;
	machine_type: string;
	running_seconds: number;
}

export async function fetchUsageByDay(
	db: D1Database,
	start: string,
	end: string,
): Promise<UsageRow[]> {
	const { results } = await db
		.prepare(SEVEN_DAY_USAGE_SQL)
		.bind(start, SECONDS_PER_SNAPSHOT, end)
		.all<UsageRow>();
	return results ?? [];
}

export async function fetchUsageByHour(
	db: D1Database,
	start: string,
	end: string,
): Promise<UsageRow[]> {
	const { results } = await db
		.prepare(HOURLY_USAGE_SQL)
		.bind(start, SECONDS_PER_SNAPSHOT, end)
		.all<UsageRow>();
	return results ?? [];
}

export async function fetchHealth(
	db: D1Database,
): Promise<{ snapshots: number; lastPollTime: string | null }> {
	const [count, last] = await Promise.all([
		db.prepare("SELECT COUNT(*) AS n FROM machine_snapshots").first<{ n: number }>(),
		db.prepare("SELECT MAX(poll_time) AS t FROM machine_snapshots").first<{ t: string | null }>(),
	]);
	return {
		snapshots: count?.n ?? 0,
		lastPollTime: last?.t ?? null,
	};
}
