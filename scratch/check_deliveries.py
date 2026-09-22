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

genuine_order_ids = {
    '6aa6eefabc8f284a896d2b67', '6aa6ef40bc8f284a896d2b68', '6aa6ef93bc8f284a896d2b69',
    '6aa6eff9bc8f284a896d2b6a', '6aa6f02fbc8f284a896d2b6b', '6aa6f9c6186bd95457350d95',
    '6aa93428c45ab51198a1088a', '6aa962d4c45ab51198a1088b', '6aa97fbca9943c3f768b7ebc',
    '6aa980bba9943c3f768b7ebd', '6aa981b2a9943c3f768b7ebe', '6aa9835f9faffd5951b7d9f4',
    '6aa984349faffd5951b7d9f5', '6aac45a63459f2214b37a982', '6aae6d6207aa91074529aa53',
    '6aae6d8607aa91074529aa54', '6aae6db107aa91074529aa55', '6aae6ddf07aa91074529aa56',
    '6aae7146f460010eb8eda1c2', '6aae7164f460010eb8eda1c4'
}

deliveries = list(client["smarteats_delivery"]["deliveries"].find({}))
genuine_del = []
test_del = []

for d in deliveries:
    oid = str(d.get("orderId"))
    if oid in genuine_order_ids:
        genuine_del.append(d)
    else:
        test_del.append(d)

print(f"Total Deliveries: {len(deliveries)}")
print(f"Genuine Deliveries: {len(genuine_del)}")
print(f"Test Deliveries: {len(test_del)}")

for d in genuine_del:
    print(f"  Genuine Delivery: {d.get('_id')} | Order: {d.get('orderId')} | Rider: {d.get('deliveryPartnerEmail')} | Status: {d.get('status')}")
