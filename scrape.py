"""
This python program scrapes the Greenwald laundry API for laundry machine data.

Functions:
    fetch(): fetches the laundry room view data from Greenwald and returns it in a JSON format.
"""

import httpx
import tomllib
import json
import tabulate

with open("config.toml", "rb") as f:
    config = tomllib.load(f)

ua = config["greenwald"]["ua"]
authkey = config["greenwald"]["authkey"]
cookie = config["greenwald"]["cookie"]

response = httpx.get("https://gpay.gi-web.net/api/v2/room-view", headers={"User-Agent": ua, "Authorization": authkey, "Cookie": cookie})

data = json.loads(response.text)
machines = []
for machine in data:
    del machine["locationName"]
    del machine["platformType"]
    del machine["topOffAvailable"] 
    del machine["multiTopOffAvailable"]
    del machine["superCycleAvailable"]
    del machine["topOffCost"]
    del machine["minutesPerTopOff"]
    machines.append(machine)

print(tabulate.tabulate(machines, headers="keys", tablefmt="grid"))
