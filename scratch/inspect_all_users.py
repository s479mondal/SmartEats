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
users = list(client["smarteats_auth"]["users"].find({}))

print(f"=== ALL {len(users)} USERS IN smarteats_auth.users ===")
for i, u in enumerate(users):
    print(f"[{i+1}] ID: {u.get('_id')} | Email: '{u.get('email')}' | Name: '{u.get('name')}' | Role: {u.get('role') or u.get('roles')}")
