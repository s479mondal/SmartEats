import os
import pymongo

uri = "mongodb+srv://soumenmondal741150_db_user:5r47pqpO9Xb2ITI6@smarteatscluster.02gfkuh.mongodb.net/smarteats_order?retryWrites=true&w=majority"
client = pymongo.MongoClient(uri)
db = client["smarteats_order"]
orders_col = db["orders"]

print("Connected to smarteats_order database.")

# Find duplicate idempotency keys
pipeline = [
    {"$match": {"idempotencyKey": {"$ne": None}}},
    {"$group": {"_id": "$idempotencyKey", "count": {"$sum": 1}, "docs": {"$push": "$_id"}}},
    {"$match": {"count": {"$gt": 1}}}
]

duplicates = list(orders_col.aggregate(pipeline))
print(f"Found {len(duplicates)} duplicate idempotency key groups.")

for dup in duplicates:
    key = dup["_id"]
    doc_ids = dup["docs"]
    # Keep the first one, delete the rest
    to_delete = doc_ids[1:]
    res = orders_col.delete_many({"_id": {"$in": to_delete}})
    print(f"Key '{key}': kept 1, deleted {res.deleted_count} duplicate documents.")

# Create the unique sparse index
print("Creating unique sparse index on idempotencyKey...")
index_name = orders_col.create_index([("idempotencyKey", pymongo.ASCENDING)], unique=True, sparse=True)
print(f"Index created/verified: {index_name}")

# List all indexes on orders collection
print("\nCurrent Indexes on 'orders' collection:")
for idx in orders_col.list_indexes():
    print(" -", idx)

client.close()
