import os
import re
from pymongo import MongoClient

env_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
env_vars = {}
with open(env_file, "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env_vars[k.strip()] = v.strip()

base_uri = env_vars.get("MONGODB_URI")
client = MongoClient(base_uri)
dp_list = list(client["smarteats_delivery"]["delivery_partners"].find({}))

genuine_dp = []
test_dp = []

for d in dp_list:
    email = d.get("email", "").lower().strip()
    name = d.get("name", "").strip()
    
    is_test = False
    if "@test.com" in email:
        is_test = True
    elif re.search(r'\d{8,}', email):
        is_test = True
    elif any(email.startswith(p) for p in [
        "drivera@", "driverb@", "e2e_", "test_", "audit_", "call_", "check_", 
        "driver_e2e_", "cust_e2e_", "driver_call_", "driver_map_", "live_driver_", 
        "beacon_driver_", "base_driver_"
    ]):
        is_test = True
    elif name.startswith("Test ") or name.startswith("Audit "):
        is_test = True
    elif "tracking_rider" in email:
        is_test = True
        
    if is_test:
        test_dp.append(d)
    else:
        genuine_dp.append(d)

print(f"Total delivery_partners: {len(dp_list)}")
print(f"Genuine delivery_partners: {len(genuine_dp)}")
print(f"Test delivery_partners: {len(test_dp)}")

print("\n--- Genuine delivery_partners ---")
for d in genuine_dp:
    print(f"  ID: {d.get('_id')} | Email: {d.get('email')} | Name: {d.get('name')} | Phone: {d.get('phoneNumber') or d.get('phone')}")

print("\n--- Sample Test delivery_partners (first 10) ---")
for d in test_dp[:10]:
    print(f"  ID: {d.get('_id')} | Email: {d.get('email')} | Name: {d.get('name')}")
