/**
 * Cloudflare Worker for SpinSight.
 *
 * Two handlers:
 *   1. scheduled  — runs every 30 min (cron trigger). Hits the Greenwald API
 *      and inserts one row per machine into the D1 `machine_snapshots` table.
 *   2. fetch      — serves GET /api/latest with the most recent row per machine.
 *
 * Secrets (set in the CF dashboard, not in wrangler.toml):
 *   GREENWALD_UA       User-Agent header for the Greenwald API.
 *   GREENWALD_AUTHKEY  Authorization header value.
 *   GREENWALD_COOKIE   Cookie header value.
 *
 * Schema lives in worker/schema.sql. Apply it once via the D1 dashboard or
 * `wrangler d1 execute spinsight --file=worker/schema.sql`.
 */

export interface Env {
	"spinsight-db": D1Database;
	GREENWALD_UA: string;
	GREENWALD_AUTHKEY: string;
	GREENWALD_COOKIE: string;
}

const API_URL = "https://gpay.gi-web.net/api/v2/room-view";

// One insert statement, reused as a prepared statement per row in a batch.
const INSERT_SQL = `
	INSERT OR REPLACE INTO machine_snapshots (
		poll_time, machine_name, location_name, bluetooth_address, status,
		platform_type, estimated_completion_time, machine_type,
		top_off_available, multi_top_off_available, super_cycle_available,
		top_off_cost, minutes_per_top_off
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const LATEST_SQL = `
	WITH ranked AS (
		SELECT *,
		       ROW_NUMBER() OVER (
		           PARTITION BY bluetooth_address
		           ORDER BY poll_time DESC
		       ) AS rn
		FROM machine_snapshots
	)
	SELECT
		poll_time, machine_name, location_name, bluetooth_address, status,
		platform_type, estimated_completion_time, machine_type,
		top_off_available, multi_top_off_available, super_cycle_available,
		top_off_cost, minutes_per_top_off
	FROM ranked
	WHERE rn = 1
	ORDER BY machine_type, machine_name
`;

interface GreenwaldMachine {
	machineName?: string;
	locationName?: string;
	bluetoothAddress: string;
	status?: string;
	platformType?: string;
	estimatedCompletionTime?: string | null;
	machineType?: string;
	topOffAvailable?: boolean;
	multiTopOffAvailable?: boolean;
	superCycleAvailable?: boolean;
	topOffCost?: number | null;
	minutesPerTopOff?: number | null;
}

function toRow(m: GreenwaldMachine, pollTime: string): unknown[] {
	return [
		pollTime,
		m.machineName ?? null,
		m.locationName ?? null,
		m.bluetoothAddress,
		m.status ?? null,
		m.platformType ?? null,
		m.estimatedCompletionTime ?? null,
		m.machineType ?? null,
		m.topOffAvailable ? 1 : 0,
		m.multiTopOffAvailable ? 1 : 0,
		m.superCycleAvailable ? 1 : 0,
		m.topOffCost ?? null,
		m.minutesPerTopOff ?? null,
	];
}

async function recordSnapshot(env: Env, machines: GreenwaldMachine[], pollTime: string): Promise<void> {
	const stmt = env["spinsight-db"].prepare(INSERT_SQL);
	const batch = machines.map((m) => stmt.bind(...(toRow(m, pollTime) as D1BindParam[])));
	await env["spinsight-db"].batch(batch);
}

async function scrape(env: Env): Promise<{ count: number; pollTime: string }> {
	const res = await fetch(API_URL, {
		headers: {
			"User-Agent": env.GREENWALD_UA,
			"Authorization": env.GREENWALD_AUTHKEY,
			"Cookie": env.GREENWALD_COOKIE,
		},
	});
	if (!res.ok) {
		throw new Error(`upstream ${res.status}: ${await res.text()}`);
	}
	const machines = (await res.json()) as GreenwaldMachine[];
	const pollTime = new Date().toISOString();
	await recordSnapshot(env, machines, pollTime);
	return { count: machines.length, pollTime };
}

export default {
	async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
		ctx.waitUntil(
			(async () => {
				try {
					const { count, pollTime } = await scrape(env);
					console.log(`[cron ${event.cron}] recorded ${count} machines at ${pollTime}`);
				} catch (err) {
					console.error(`[cron ${event.cron}] scrape failed:`, err);
				}
			})(),
		);
	},

	async fetch(req: Request, env: Env): Promise<Response> {
		const url = new URL(req.url);

		if (url.pathname === "/api/latest") {
			const { results } = await env["spinsight-db"].prepare(LATEST_SQL).all<D1Record<string, unknown>>();
			return Response.json(results, {
				headers: { "Cache-Control": "public, max-age=60" },
			});
		}

		if (url.pathname === "/api/health") {
			const row = await env["spinsight-db"].prepare("SELECT COUNT(*) AS n FROM machine_snapshots").first<{ n: number }>();
			return Response.json({ ok: true, snapshots: row?.n ?? 0 });
		}

		return new Response("not found", { status: 404 });
	},
};
