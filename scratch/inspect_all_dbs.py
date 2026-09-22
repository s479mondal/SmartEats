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

db_names = client.list_database_names()
print("All Cluster Databases:", db_names)

target_dbs = [d for d in db_names if "smarteats" in d.lower()]
print("Target SmartEats Databases:", target_dbs)

for db_name in target_dbs:
    db = client[db_name]
    print(f"\n==========================================")
    print(f"DATABASE: {db_name}")
    print(f"==========================================")
    cols = db.list_collection_names()
    for col_name in cols:
        col = db[col_name]
        count = col.count_documents({})
        print(f"  Collection: {col_name} (Total documents: {count})")
        sample = list(col.find({}).limit(5))
        for doc in sample:
            doc_id = str(doc.get("_id"))
            # summarize doc
            summary = {k: str(v)[:60] for k, v in doc.items() if k != "_id"}
            print(f"    - ID: {doc_id} -> {summary}")
