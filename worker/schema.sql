-- D1 schema for SpinSight. Mirrors the local SQLite table from store.py.
-- Apply once after creating the D1 database:
--   wrangler d1 execute spinsight --file=worker/schema.sql
-- or paste into the D1 SQL editor in the Cloudflare dashboard.

CREATE TABLE IF NOT EXISTS machine_snapshots (
	poll_time                    TEXT    NOT NULL,
	machine_name                 TEXT,
	location_name                TEXT,
	bluetooth_address            TEXT    NOT NULL,
	status                       TEXT,
	platform_type                TEXT,
	estimated_completion_time    TEXT,
	machine_type                 TEXT,
	top_off_available            INTEGER,
	multi_top_off_available      INTEGER,
	super_cycle_available        INTEGER,
	top_off_cost                 REAL,
	minutes_per_top_off          INTEGER,
	PRIMARY KEY (poll_time, bluetooth_address)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_bluetooth_poll
	ON machine_snapshots (bluetooth_address, poll_time DESC);
