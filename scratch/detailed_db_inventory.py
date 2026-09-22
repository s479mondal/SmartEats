import os
import json
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

dbs = ["smarteats_auth", "smarteats_restaurant", "smarteats_order", "smarteats_delivery", "smarteats_notification", "smarteats"]

inventory = {}
for db_name in dbs:
    db = client[db_name]
    inventory[db_name] = {}
    for col_name in db.list_collection_names():
        col = db[col_name]
        docs = list(col.find({}))
        inventory[db_name][col_name] = len(docs)

print(json.dumps(inventory, indent=2))
