import os
from pymongo import MongoClient
import re

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
orders = list(client["smarteats_order"]["orders"].find({}))

genuine_orders = []
test_orders = []

test_rest_ids = {
    '6aac2d6cd5fab0732a03dc1a', '6aac2d6dd5fab0732a03dc1b', '6aac2d7fd5fab0732a03dc1c',
    '6aac2d9bd5fab0732a03dc1d', '6aac2da0d5fab0732a03dc1e', '6aac3a79a7414d31b7979fe5',
    '6aac3a94a7414d31b7979fe6', '6aac3b138ffe8b16ebbb0db5', '6aac51ff70fa0b4fddae551b',
    '6aac532c8d2b601d821f6015', '6aac53598d2b601d821f6016', '6aac535e8d2b601d821f6017',
    '6aac53798d2b601d821f6018', '6aac537e8d2b601d821f6019', '6aac539b8d2b601d821f601a',
    '6aac53a08d2b601d821f601b', '6aac53d58d2b601d821f601c', '6aac53e18d2b601d821f601d',
    '6aae2056c9cc0e6b9f71e2a2', '6aae7b15ff6b6473e11d4828', '6aaeee88bc880c2fc3110379',
    '6aaeee89bc880c2fc311037a', '6aaeee8fbc880c2fc311037b', '6aaeeeb6bc880c2fc311037d',
    '6aaeeee9bc880c2fc311037e', '6aaeef7cbc880c2fc311037f', '6aaef240bc880c2fc3110380',
    '6aaef4a0bc880c2fc3110381', '6aaef4c2bc880c2fc3110383', '6aaef4ddbc880c2fc3110385',
    '6aaef4fcbc880c2fc3110387'
}

for o in orders:
    c_email = o.get("customerEmail", "").lower().strip()
    idemp = str(o.get("idempotencyKey", ""))
    rest_id = str(o.get("restaurantId", ""))
    
    is_test = False
    if rest_id in test_rest_ids:
        is_test = True
    elif "@test.com" in c_email:
        is_test = True
    elif re.search(r'\d{8,}', c_email):
        is_test = True
    elif any(c_email.startswith(p) for p in [
        "step4_", "step8", "antispoof", "idemp_", "webhook_cust_", 
        "cod_cust_", "live_cust_", "cust_", "call_cust_", "notif_audit_", "check_c_", "audit_"
    ]):
        is_test = True
    elif "test" in idemp.lower():
        is_test = True
    # Check the 4 orders created during our verification session:
    elif c_email == "s1@gmail.com" and rest_id == "6ab060f54e48f1061d3e2629":
        # Check if created in recent test session (today 2026-09-21)
        is_test = True
        
    if is_test:
        test_orders.append(o)
    else:
        genuine_orders.append(o)

print(f"Total Orders: {len(orders)}")
print(f"Genuine Orders: {len(genuine_orders)}")
print(f"Test Orders: {len(test_orders)}")

print("\nGenuine orders list:")
for o in genuine_orders:
    print(f"  {o.get('_id')} | Customer: {o.get('customerEmail')} | Rest: {o.get('restaurantId')} | Status: {o.get('status')} | Items: {len(o.get('items', []))}")
