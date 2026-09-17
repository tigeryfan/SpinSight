/**
 * Top-level scrape orchestration.
 *
 * Each scheduled run fetches the room-view payload from Greenwald, parses
 * each record into a normalized Machine, and writes them all into
 * machine_snapshots in a single batched insert. Everything the API serves is
 * computed on demand from this table — there is no derived state to keep in
 * sync.
 */

import type { Env } from "./env";
import { fetchMachines } from "./upstream";
import { parseMachine } from "./types";
import { insertSnapshots } from "./store/snapshots";

export interface ScrapeSummary {
	pollTime: string;
	machineCount: number;
	skippedCount: number;
}

export async function runScrape(env: Env): Promise<ScrapeSummary> {
	const { machines, fetchedAt } = await fetchMachines(env);

	const pollTime = fetchedAt;
	const parsed = [];
	let skipped = 0;
	for (const raw of machines) {
		try {
			parsed.push(parseMachine(raw, pollTime));
		} catch (err) {
			skipped += 1;
			console.warn(`[scraper] skipping record: ${(err as Error).message}`);
		}
	}

	await insertSnapshots(env["spinsight-db"], parsed, pollTime);

	return {
		pollTime,
		machineCount: parsed.length,
		skippedCount: skipped,
	};
}
