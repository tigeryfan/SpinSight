/**
 * GET /api/health — liveness probe + storage summary.
 */

import { fetchHealth } from "../store/snapshots";

export interface HealthResponse {
	ok: boolean;
	snapshots: number;
	lastPollTime: string | null;
}

export async function handleHealth(db: D1Database): Promise<Response> {
	const { snapshots, lastPollTime } = await fetchHealth(db);
	const body: HealthResponse = {
		ok: true,
		snapshots,
		lastPollTime,
	};
	return Response.json(body, {
		headers: { "Cache-Control": "no-store" },
	});
}
