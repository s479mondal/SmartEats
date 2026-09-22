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

GENUINE_RESTAURANT_IDS = {
    'rest_101', 'rest_102', '6a8f2c0c877c6b29526aeb58', 
    '6a8f30e8877c6b29526aeb59', '6aac3399d5fab0732a03dc1f', '6ab060f54e48f1061d3e2629'
}

GENUINE_DP_EMAILS = {
    'ajay.rider@smarteats.com', 'driver@smarteats.com', 'g@gmail.com'
}

GENUINE_ORDER_IDS = {
    '6aa6eefabc8f284a896d2b67', '6aa6ef40bc8f284a896d2b68', '6aa6ef93bc8f284a896d2b69',
    '6aa6eff9bc8f284a896d2b6a', '6aa6f02fbc8f284a896d2b6b', '6aa6f9c6186bd95457350d95',
    '6aa93428c45ab51198a1088a', '6aa962d4c45ab51198a1088b', '6aa97fbca9943c3f768b7ebc',
    '6aa980bba9943c3f768b7ebd', '6aa981b2a9943c3f768b7ebe', '6aa9835f9faffd5951b7d9f4',
    '6aa984349faffd5951b7d9f5', '6aac45a63459f2214b37a982', '6aae6d6207aa91074529aa53',
    '6aae6d8607aa91074529aa54', '6aae6db107aa91074529aa55', '6aae6ddf07aa91074529aa56',
    '6aae7146f460010eb8eda1c2', '6aae7164f460010eb8eda1c4'
}

audit_log = {}

# 1. smarteats_auth.users
col_users = client["smarteats_auth"]["users"]
users_to_delete = [u["_id"] for u in col_users.find({}) if u.get("email", "").lower().strip() not in GENUINE_USER_EMAILS]
res_users = col_users.delete_many({"_id": {"$in": users_to_delete}})
audit_log["smarteats_auth.users"] = {
    "deleted": res_users.deleted_count,
    "remaining": col_users.count_documents({})
}

# 2. smarteats_restaurant.restaurants
col_rests = client["smarteats_restaurant"]["restaurants"]
rests_to_delete = [r["_id"] for r in col_rests.find({}) if str(r["_id"]) not in GENUINE_RESTAURANT_IDS]
res_rests = col_rests.delete_many({"_id": {"$in": rests_to_delete}})
audit_log["smarteats_restaurant.restaurants"] = {
    "deleted": res_rests.deleted_count,
    "remaining": col_rests.count_documents({})
}

# 3. smarteats_restaurant.menuItems
col_items = client["smarteats_restaurant"]["menuItems"]
items_to_delete = [m["_id"] for m in col_items.find({}) if str(m.get("restaurantId")) not in GENUINE_RESTAURANT_IDS]
res_items = col_items.delete_many({"_id": {"$in": items_to_delete}})
audit_log["smarteats_restaurant.menuItems"] = {
    "deleted": res_items.deleted_count,
    "remaining": col_items.count_documents({})
}

# Restore Chicken Biryani quantity
col_items.update_one(
    {"name": "Chicken Biryani", "restaurantId": "6ab060f54e48f1061d3e2629"},
    {"$set": {"availableQuantity": 20}}
)

# 4. smarteats_delivery.delivery_partners
col_dp = client["smarteats_delivery"]["delivery_partners"]
dp_to_delete = [d["_id"] for d in col_dp.find({}) if d.get("email", "").lower().strip() not in GENUINE_DP_EMAILS]
res_dp = col_dp.delete_many({"_id": {"$in": dp_to_delete}})
audit_log["smarteats_delivery.delivery_partners"] = {
    "deleted": res_dp.deleted_count,
    "remaining": col_dp.count_documents({})
}

# 5. smarteats_delivery.partners
col_partners = client["smarteats_delivery"]["partners"]
audit_log["smarteats_delivery.partners"] = {
    "deleted": 0,
    "remaining": col_partners.count_documents({})
}

# 6. smarteats_order.orders
col_orders = client["smarteats_order"]["orders"]
orders_to_delete = [o["_id"] for o in col_orders.find({}) if str(o["_id"]) not in GENUINE_ORDER_IDS]
res_orders = col_orders.delete_many({"_id": {"$in": orders_to_delete}})
audit_log["smarteats_order.orders"] = {
    "deleted": res_orders.deleted_count,
    "remaining": col_orders.count_documents({})
}

# 7. smarteats_delivery.deliveries
col_deliveries = client["smarteats_delivery"]["deliveries"]
deliveries_to_delete = [d["_id"] for d in col_deliveries.find({}) if str(d.get("orderId")) not in GENUINE_ORDER_IDS]
res_deliveries = col_deliveries.delete_many({"_id": {"$in": deliveries_to_delete}})
audit_log["smarteats_delivery.deliveries"] = {
    "deleted": res_deliveries.deleted_count,
    "remaining": col_deliveries.count_documents({})
}

# 8. smarteats_notification.notifications
col_notifs = client["smarteats_notification"]["notifications"]
notifs_to_delete = [
    n["_id"] for n in col_notifs.find({}) 
    if str(n.get("orderId", "")).replace('"', '').strip() not in GENUINE_ORDER_IDS
    or n.get("recipientEmail", "").lower().strip() not in GENUINE_USER_EMAILS
]
res_notifs = col_notifs.delete_many({"_id": {"$in": notifs_to_delete}})
audit_log["smarteats_notification.notifications"] = {
    "deleted": res_notifs.deleted_count,
    "remaining": col_notifs.count_documents({})
}

print("==================================================")
print("             CLEANUP EXECUTION RESULT             ")
print("==================================================")
print(json.dumps(audit_log, indent=2))
