import requests
import json
from datetime import datetime
from zoneinfo import ZoneInfo

ist = ZoneInfo('Asia/Kolkata')
now_ist = datetime.now(ist)
print(f"Current Time (Asia/Kolkata): {now_ist.strftime('%Y-%m-%d %I:%M:%S %p (%H:%M:%S)')}")

url = "http://localhost:8082/api/restaurants"
res = requests.get(url)
print(f"Status Code: {res.status_code}")
data = res.json()
print("Data structure:", type(data))

restaurants = data.get('data', []) if isinstance(data, dict) else data

print(f"\nFound {len(restaurants)} approved restaurants:\n" + "="*70)
for r in restaurants:
    name = r.get('name')
    open_time = r.get('openingTime')
    close_time = r.get('closingTime')
    is_open = r.get('open')
    status = r.get('status')
    print(f"Restaurant: '{name}'")
    print(f"  Schedule: {open_time} -> {close_time}")
    print(f"  Live 'open' boolean: {is_open}")
    print(f"  Status: {status}")
    print("-" * 50)
