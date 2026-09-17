/**
 * GET /api/usage — rolling usage series for the dashboard chart.
 *
 *   ?range=7d           7 daily rollups ending today (UTC)
 *   ?range=1d           24 hourly rollups for today (UTC)
 *   ?range=1d&date=...  24 hourly rollups for the given UTC day
 *
 * Each scrape represents the 30 minutes ending at its poll_time, so a snapshot
 * with status "running" contributes 30 minutes of running-seconds. The query
 * sums that up per machine_type and divides by the window length to get
 * average concurrent machines.
 */

import { fetchUsageByDay, fetchUsageByHour } from "../store/snapshots";

export type UsageRange = "7d" | "1d";

export interface UsageResponse {
	range: UsageRange;
	labels: string[];
	washer: number[];
	dryer: number[];
	windowStart: string;
	windowEnd: string;
}

const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_HOUR = 3_600;

function utcDayBounds(dateIso: string): { start: string; end: string; day: string } {
	const ms = Date.parse(`${dateIso}T00:00:00Z`);
	if (Number.isNaN(ms)) {
		throw new Error(`invalid date: ${dateIso}`);
	}
	const start = new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
	const end = new Date(ms + 24 * 60 * 60 * 1000).toISOString()
		.replace(/\.\d{3}Z$/, "Z");
	const day = new Date(ms).toISOString().slice(0, 10);
	return { start, end, day };
}

function utcSevenDayBounds(now: Date): { start: string; end: string; days: string[] } {
	const todayUtc = Date.UTC(
		now.getUTCFullYear(),
		now.getUTCMonth(),
		now.getUTCDate(),
		0, 0, 0, 0,
	);
	const start = new Date(todayUtc - 6 * 24 * 60 * 60 * 1000).toISOString()
		.replace(/\.\d{3}Z$/, "Z");
	const end = new Date(todayUtc + 24 * 60 * 60 * 1000).toISOString()
		.replace(/\.\d{3}Z$/, "Z");
	const days: string[] = [];
	for (let i = 0; i < 7; i++) {
		const dayMs = todayUtc - (6 - i) * 24 * 60 * 60 * 1000;
		days.push(new Date(dayMs).toISOString().slice(0, 10));
	}
	return { start, end, days };
}

function round(value: number, places: number): number {
	const factor = 10 ** places;
	return Math.round(value * factor) / factor;
}

function isWasher(machineType: string): boolean {
	return machineType.toLowerCase().includes("wash");
}

export async function handleUsage(
	db: D1Database,
	url: URL,
): Promise<Response> {
	const range = (url.searchParams.get("range") ?? "7d") as UsageRange;
	if (range !== "7d" && range !== "1d") {
		return Response.json(
			{ error: "range must be '7d' or '1d'" },
			{ status: 400 },
		);
	}

	if (range === "7d") {
		const { start, end, days } = utcSevenDayBounds(new Date());
		const rows = await fetchUsageByDay(db, start, end);
		const washer = new Array<number>(7).fill(0);
		const dryer = new Array<number>(7).fill(0);
		for (const row of rows) {
			if (!row.day) continue;
			const idx = days.indexOf(row.day);
			if (idx === -1) continue;
			const avg = row.running_seconds / SECONDS_PER_DAY;
			if (isWasher(row.machine_type)) washer[idx] = round(avg, 3);
			else dryer[idx] = round(avg, 3);
		}
		const body: UsageResponse = {
			range,
			labels: days,
			washer,
			dryer,
			windowStart: start,
			windowEnd: end,
		};
		return Response.json(body, {
			headers: { "Cache-Control": "public, max-age=300" },
		});
	}

	const dateParam = url.searchParams.get("date");
	const { start, end, day } = dateParam
		? utcDayBounds(dateParam)
		: utcDayBounds(new Date().toISOString().slice(0, 10));
	void day;

	const rows = await fetchUsageByHour(db, start, end);
	const labels: string[] = [];
	const washer = new Array<number>(24).fill(0);
	const dryer = new Array<number>(24).fill(0);
	for (let i = 0; i < 24; i++) {
		const hourMs = Date.parse(start) + i * 60 * 60 * 1000;
		labels.push(new Date(hourMs).toISOString().slice(0, 13) + ":00");
	}
	for (const row of rows) {
		if (!row.hour) continue;
		const hourIdx = Number(row.hour.slice(11, 13));
		if (!Number.isFinite(hourIdx)) continue;
		const avg = row.running_seconds / SECONDS_PER_HOUR;
		if (isWasher(row.machine_type)) washer[hourIdx] = round(avg, 3);
		else dryer[hourIdx] = round(avg, 3);
	}
	const body: UsageResponse = {
		range,
		labels,
		washer,
		dryer,
		windowStart: start,
		windowEnd: end,
	};
	return Response.json(body, {
		headers: { "Cache-Control": "public, max-age=300" },
	});
}
