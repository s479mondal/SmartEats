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
partners = list(client["smarteats_delivery"]["delivery_partners"].find({}))

print(f"=== ALL {len(partners)} DELIVERY PARTNERS ===")
for i, p in enumerate(partners):
    print(f"[{i+1}] ID: {p.get('_id')} | Email: '{p.get('email')}' | Name: '{p.get('name')}' | Phone: '{p.get('phoneNumber') or p.get('phone')}' | Reg: '{p.get('vehicleNumber')}'")
