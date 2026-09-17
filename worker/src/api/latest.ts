/**
 * GET /api/latest — every machine with its current status.
 *
 * Reads from machine_snapshots and keeps only the most recent row per
 * bluetooth_address via a ROW_NUMBER() window.
 */

import { fetchLatest, type SnapshotRow } from "../store/snapshots";

export interface LatestResponse {
	machines: SnapshotRow[];
	count: number;
	fetchedAt: string | null;
}

export async function handleLatest(db: D1Database): Promise<Response> {
	const machines = await fetchLatest(db);
	const fetchedAt = machines.reduce<string | null>(
		(acc, m) => (acc === null || m.poll_time > acc ? m.poll_time : acc),
		null,
	);
	const body: LatestResponse = {
		machines,
		count: machines.length,
		fetchedAt,
	};
	return Response.json(body, {
		headers: { "Cache-Control": "public, max-age=60" },
	});
}
