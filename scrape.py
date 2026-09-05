"""
This python program scrapes the Greenwald laundry API for laundry machine data.

Functions:
    fetch(): fetches the laundry room view data from Greenwald and returns it in a JSON format.
"""

import argparse
import httpx
import tomllib
import json
import tabulate
import pandas as pd
from datetime import datetime, timezone
from pathlib import Path

parser = argparse.ArgumentParser(description="Scrape the Greenwald laundry API for laundry machine data.")
parser.add_argument("--table", action="store_true", help="print the scraped data as a table")
args = parser.parse_args()

with open("config.toml", "rb") as f:
    config = tomllib.load(f)

ua = config["greenwald"]["ua"]
authkey = config["greenwald"]["authkey"]
cookie = config["greenwald"]["cookie"]

response = httpx.get("https://gpay.gi-web.net/api/v2/room-view", headers={"User-Agent": ua, "Authorization": authkey, "Cookie": cookie})

data = json.loads(response.text)

poll_time = datetime.now(timezone.utc)

df = pd.DataFrame(data)
df["pollTime"] = poll_time

parquet_path = Path("laundry_data.parquet")
if parquet_path.exists():
    existing = pd.read_parquet(parquet_path)
    df = pd.concat([existing, df], ignore_index=True)

df.to_parquet(parquet_path, index=False)

if args.table:
    print(tabulate.tabulate(df, headers="keys", tablefmt="grid"))
