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
users = list(client["smarteats_auth"]["users"].find({}))

# Check which users are genuine seed or human-created vs automated test runners
# Automated test runners use patterns like:
# - timestamp in email: 17898... or 17896...
# - @test.com
# - email prefixes like: test, e2e_, audit_, call_, driver_e2e_, cust_e2e_, driver_call_, check_c_, notif_audit_, etc.
# - names like "Test CUSTOMER ...", "Test DELIVERY_PARTNER ...", "Test RESTAURANT_OWNER ...", "Audit Driver", "Audit Customer"

genuine_users = []
test_users = []

for u in users:
    email = u.get("email", "").lower().strip()
    name = u.get("name", "").strip()
    
    is_test = False
    if "@test.com" in email:
        is_test = True
    elif re.search(r'\d{8,}', email): # unix timestamp in email
        is_test = True
    elif any(email.startswith(p) for p in [
        "e2e_", "test_", "audit_", "call_", "check_", "notif_", "driver_e2e_", 
        "cust_e2e_", "driver_call_", "driver_map_", "live_driver_", "beacon_driver_",
        "live_cust_", "step4_", "step8", "antispoof", "idemp_", "webhook_cust_", 
        "drivera@", "driverb@", "rural_owner_", "biryani_owner_", "rest_reg_", 
        "durgapur_time_", "overnight_diner_"
    ]):
        is_test = True
    elif name.startswith("Test ") or name.startswith("Audit "):
        is_test = True
    elif "temp" in email or "dummy" in email:
        is_test = True
        
    if is_test:
        test_users.append(u)
    else:
        genuine_users.append(u)

print(f"Total Users in smarteats_auth.users: {len(users)}")
print(f"Genuine Users Identified: {len(genuine_users)}")
print(f"Test Users Identified: {len(test_users)}")

print("\n--- ALL GENUINE USERS ---")
for i, u in enumerate(genuine_users):
    print(f"[{i+1}] ID: {u.get('_id')} | Email: '{u.get('email')}' | Name: '{u.get('name')}' | Role: {u.get('role') or u.get('roles')}")

