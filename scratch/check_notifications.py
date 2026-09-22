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

genuine_user_emails = {
    'admin@smarteats.com', 'ngo@smarteats.com', 'customer@smarteats.com', 
    'restaurant@smarteats.com', 'driver@smarteats.com', 'clouduser@smarteats.com', 
    's479mondal@gmail.com', 's4mondal@gmail.com', 'priya.customer@smarteats.com', 
    'marco.pizza@smarteats.com', 'ajay.rider@smarteats.com', 'ananya.ngo@smarteats.com', 
    'd@gmail.com', 's7mondal@gmail.com', 'customer2@smarteats.com', 's@gmail.com', 
    'realcustomer_step8@smarteats.com', 'testcustomer2026@smarteats.com', 
    'soumen_pin_test_final@smarteats.com', 's1@gmail.com', 
    'soumen.mondal2025@vitstudent.ac.in', 'g@gmail.com', 'r@gmail.com'
}

notifs = list(client["smarteats_notification"]["notifications"].find({}))
genuine_notifs = []
test_notifs = []

for n in notifs:
    r_email = n.get("recipientEmail", "").lower().strip()
    oid = str(n.get("orderId", "")).replace('"', '').strip()
    
    # If it references a genuine order OR belongs to genuine user and does not reference a test order
    if oid and oid not in genuine_order_ids:
        test_notifs.append(n)
    elif r_email not in genuine_user_emails:
        test_notifs.append(n)
    else:
        genuine_notifs.append(n)

print(f"Total Notifications: {len(notifs)}")
print(f"Genuine Notifications: {len(genuine_notifs)}")
print(f"Test Notifications: {len(test_notifs)}")

print("Sample genuine notifications (5):")
for n in genuine_notifs[:5]:
    print(f"  {n.get('_id')} | Recipient: {n.get('recipientEmail')} | Order: {n.get('orderId')} | Type: {n.get('type')}")

print("Sample test notifications (5):")
for n in test_notifs[:5]:
    print(f"  {n.get('_id')} | Recipient: {n.get('recipientEmail')} | Order: {n.get('orderId')} | Type: {n.get('type')}")
