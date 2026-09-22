CREATE TABLE IF NOT EXISTS machine_snapshots (
    bluetooth_address TEXT NOT NULL,
    poll_time TEXT NOT NULL, -- ISO 8601 UTC
    machine_name TEXT,
    location_name TEXT,
    status TEXT,
    platform_type TEXT,
    machine_type TEXT, -- 'Washer' | 'Dryer'
    estimated_completion_time TEXT,
    top_off_available INTEGER NOT NULL DEFAULT 0,
    multi_top_off_available INTEGER NOT NULL DEFAULT 0,
    super_cycle_available INTEGER NOT NULL DEFAULT 0,
    top_off_cost REAL,
    minutes_per_top_off REAL,
    PRIMARY KEY (bluetooth_address, poll_time)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_poll_time ON machine_snapshots (poll_time DESC);

CREATE INDEX IF NOT EXISTS idx_snapshots_location_poll ON machine_snapshots (location_name, poll_time DESC);