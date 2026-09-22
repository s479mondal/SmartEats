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

# 1. Preserved Genuine User Emails
GENUINE_USER_EMAILS = {
    'admin@smarteats.com', 'ngo@smarteats.com', 'customer@smarteats.com', 
    'restaurant@smarteats.com', 'driver@smarteats.com', 'clouduser@smarteats.com', 
    's479mondal@gmail.com', 's4mondal@gmail.com', 'priya.customer@smarteats.com', 
    'marco.pizza@smarteats.com', 'ajay.rider@smarteats.com', 'ananya.ngo@smarteats.com', 
    'd@gmail.com', 's7mondal@gmail.com', 'customer2@smarteats.com', 's@gmail.com', 
    'realcustomer_step8@smarteats.com', 'testcustomer2026@smarteats.com', 
    'soumen_pin_test_final@smarteats.com', 's1@gmail.com', 
    'soumen.mondal2025@vitstudent.ac.in', 'g@gmail.com', 'r@gmail.com'
}

# 2. Preserved Genuine Restaurant IDs
GENUINE_RESTAURANT_IDS = {
    'rest_101', 'rest_102', '6a8f2c0c877c6b29526aeb58', 
    '6a8f30e8877c6b29526aeb59', '6aac3399d5fab0732a03dc1f', '6ab060f54e48f1061d3e2629'
}

# 3. Preserved Genuine Delivery Partner Emails
GENUINE_DP_EMAILS = {
    'ajay.rider@smarteats.com', 'driver@smarteats.com', 'g@gmail.com'
}

# 4. Genuine Orders
GENUINE_ORDER_IDS = {
    '6aa6eefabc8f284a896d2b67', '6aa6ef40bc8f284a896d2b68', '6aa6ef93bc8f284a896d2b69',
    '6aa6eff9bc8f284a896d2b6a', '6aa6f02fbc8f284a896d2b6b', '6aa6f9c6186bd95457350d95',
    '6aa93428c45ab51198a1088a', '6aa962d4c45ab51198a1088b', '6aa97fbca9943c3f768b7ebc',
    '6aa980bba9943c3f768b7ebd', '6aa981b2a9943c3f768b7ebe', '6aa9835f9faffd5951b7d9f4',
    '6aa984349faffd5951b7d9f5', '6aac45a63459f2214b37a982', '6aae6d6207aa91074529aa53',
    '6aae6d8607aa91074529aa54', '6aae6db107aa91074529aa55', '6aae6ddf07aa91074529aa56',
    '6aae7146f460010eb8eda1c2', '6aae7164f460010eb8eda1c4'
}

print("==================================================")
print("             DRY RUN CLEANUP REPORT               ")
print("==================================================")

# A. Users
all_users = list(client["smarteats_auth"]["users"].find({}))
users_to_delete = [u["_id"] for u in all_users if u.get("email", "").lower().strip() not in GENUINE_USER_EMAILS]
print(f"smarteats_auth.users: Total={len(all_users)}, Delete={len(users_to_delete)}, Preserve={len(all_users) - len(users_to_delete)}")

# B. Restaurants
all_rests = list(client["smarteats_restaurant"]["restaurants"].find({}))
rests_to_delete = [r["_id"] for r in all_rests if str(r["_id"]) not in GENUINE_RESTAURANT_IDS]
print(f"smarteats_restaurant.restaurants: Total={len(all_rests)}, Delete={len(rests_to_delete)}, Preserve={len(all_rests) - len(rests_to_delete)}")

# C. Menu Items
all_items = list(client["smarteats_restaurant"]["menuItems"].find({}))
items_to_delete = [m["_id"] for m in all_items if str(m.get("restaurantId")) not in GENUINE_RESTAURANT_IDS]
print(f"smarteats_restaurant.menuItems: Total={len(all_items)}, Delete={len(items_to_delete)}, Preserve={len(all_items) - len(items_to_delete)}")

# D. Delivery Partners
all_dp = list(client["smarteats_delivery"]["delivery_partners"].find({}))
dp_to_delete = [d["_id"] for d in all_dp if d.get("email", "").lower().strip() not in GENUINE_DP_EMAILS]
print(f"smarteats_delivery.delivery_partners: Total={len(all_dp)}, Delete={len(dp_to_delete)}, Preserve={len(all_dp) - len(dp_to_delete)}")

# E. Partners
all_partners = list(client["smarteats_delivery"]["partners"].find({}))
print(f"smarteats_delivery.partners: Total={len(all_partners)}, Delete=0, Preserve={len(all_partners)}")

# F. Orders
all_orders = list(client["smarteats_order"]["orders"].find({}))
orders_to_delete = [o["_id"] for o in all_orders if str(o["_id"]) not in GENUINE_ORDER_IDS]
print(f"smarteats_order.orders: Total={len(all_orders)}, Delete={len(orders_to_delete)}, Preserve={len(all_orders) - len(orders_to_delete)}")

# G. Deliveries
all_deliveries = list(client["smarteats_delivery"]["deliveries"].find({}))
deliveries_to_delete = [d["_id"] for d in all_deliveries if str(d.get("orderId")) not in GENUINE_ORDER_IDS]
print(f"smarteats_delivery.deliveries: Total={len(all_deliveries)}, Delete={len(deliveries_to_delete)}, Preserve={len(all_deliveries) - len(deliveries_to_delete)}")

# H. Notifications
all_notifs = list(client["smarteats_notification"]["notifications"].find({}))
notifs_to_delete = [
    n["_id"] for n in all_notifs 
    if str(n.get("orderId", "")).replace('"', '').strip() not in GENUINE_ORDER_IDS
    or n.get("recipientEmail", "").lower().strip() not in GENUINE_USER_EMAILS
]
print(f"smarteats_notification.notifications: Total={len(all_notifs)}, Delete={len(notifs_to_delete)}, Preserve={len(all_notifs) - len(notifs_to_delete)}")

print("==================================================")
print(f"TOTAL RECORDS TO DELETE ACROSS ALL DATABASES: {len(users_to_delete) + len(rests_to_delete) + len(items_to_delete) + len(dp_to_delete) + len(orders_to_delete) + len(deliveries_to_delete) + len(notifs_to_delete)}")
print("==================================================")
