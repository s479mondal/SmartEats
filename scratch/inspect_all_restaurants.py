import os
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
rests = list(client["smarteats_restaurant"]["restaurants"].find({}))

print(f"=== ALL {len(rests)} RESTAURANTS ===")
for i, r in enumerate(rests):
    print(f"[{i+1}] ID: {r.get('_id')} | Name: '{r.get('name')}' | Owner: {r.get('ownerEmail')} | Reg: {r.get('businessRegistrationNumber')} | Created: {r.get('createdAt')}")

print("\n=== ALL MENU ITEMS ===")
items = list(client["smarteats_restaurant"]["menuItems"].find({}))
for i, m in enumerate(items):
    print(f"[{i+1}] ID: {m.get('_id')} | Name: '{m.get('name')}' | RestId: {m.get('restaurantId')} | Price: {m.get('price')}")
