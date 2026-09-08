"""
Fetches laundry machine room data from the Greenwald API, and optionally outputs a table.
"""

import argparse
import json
import sys
import tomllib

import httpx
import tabulate

API_URL = "https://gpay.gi-web.net/api/v2/room-view"


def fetch_machines(config_path: str = "config.toml") -> list[dict]:
    """Load credentials from config, queries the API, then returns the parsed JSON list."""
    with open(config_path, "rb") as f:
        config = tomllib.load(f)

    headers = {
        "User-Agent": config["greenwald"]["ua"],
        "Authorization": config["greenwald"]["authkey"],
        "Cookie": config["greenwald"]["cookie"],
    }

    response = httpx.get(API_URL, headers=headers)
    response.raise_for_status()
    return json.loads(response.text)


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch the Greenwald laundry room view.")
    parser.add_argument(
        "--table",
        action="store_true",
        help="print the fetched data as a table (does not store anything)",
    )
    parser.add_argument(
        "--store",
        action="store_true",
        help="record the fetch in laundry_data.duckdb",
    )
    args = parser.parse_args()

    machines = fetch_machines()

    if args.table:
        print(tabulate.tabulate(machines, headers="keys", tablefmt="grid"))

    if args.store:
        from store import init_db, record_snapshot  # local import keeps --table fast
        init_db()
        poll_time = record_snapshot(machines)
        print(f"recorded {len(machines)} machines at {poll_time.isoformat()}")

    if not (args.table or args.store):
        print(json.dumps(machines, indent=2))

    return 0


if __name__ == "__main__":
    sys.exit(main())
