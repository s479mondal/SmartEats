import os
from pymongo import MongoClient
from collections import Counter
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

print("==================================================")
print("1. USERS ANALYSIS (smarteats_auth.users)")
print("==================================================")
users = list(client["smarteats_auth"]["users"].find({}))
print(f"Total Users: {len(users)}")

# Categorize users by email domain or pattern
domains = Counter()
test_user_candidates = []
genuine_user_candidates = []

for u in users:
    email = u.get("email", "")
    role = u.get("role") or u.get("roles")
    name = u.get("name", "")
    domain = email.split("@")[-1] if "@" in email else "no-domain"
    domains[domain] += 1
    
    # Check if looks like automated/test
    is_test = False
    if "test" in email.lower() or "temp" in email.lower() or "dummy" in email.lower() or "e2e" in email.lower():
        is_test = True
    elif re.search(r'\d{8,}', email): # e.g. timestamp in email like 1789668714
        is_test = True
    elif "mock" in email.lower():
        is_test = True
        
    if is_test:
        test_user_candidates.append(u)
    else:
        genuine_user_candidates.append(u)

print("User count by domain:", domains.most_common(15))
print(f"Identified Test user candidates: {len(test_user_candidates)}")
print(f"Identified Genuine user candidates: {len(genuine_user_candidates)}")
print("Sample Genuine Users:")
for u in genuine_user_candidates[:15]:
    print(f"  - {u.get('email')} | {u.get('name')} | {u.get('role')} | ID: {u.get('_id')}")

print("\nSample Test Users:")
for u in test_user_candidates[:15]:
    print(f"  - {u.get('email')} | {u.get('name')} | {u.get('role')} | ID: {u.get('_id')}")

print("\n==================================================")
print("2. RESTAURANTS ANALYSIS (smarteats_restaurant.restaurants)")
print("==================================================")
rests = list(client["smarteats_restaurant"]["restaurants"].find({}))
print(f"Total Restaurants: {len(rests)}")
for r in rests:
    print(f"  - ID: {r.get('_id')} | Name: '{r.get('name')}' | Owner: {r.get('ownerEmail')} | Reg: {r.get('businessRegistrationNumber')} | Status: {r.get('status')} | Approved: {r.get('approved')}")

print("\n==================================================")
print("3. MENU ITEMS ANALYSIS (smarteats_restaurant.menuItems)")
print("==================================================")
menu_items = list(client["smarteats_restaurant"]["menuItems"].find({}))
print(f"Total Menu Items: {len(menu_items)}")
for m in menu_items:
    print(f"  - ID: {m.get('_id')} | Name: '{m.get('name')}' | RestID: {m.get('restaurantId')} | Price: {m.get('price')} | Avail: {m.get('available')}")

print("\n==================================================")
print("4. DELIVERY PARTNERS (smarteats_delivery.delivery_partners / partners)")
print("==================================================")
dp1 = list(client["smarteats_delivery"]["delivery_partners"].find({}))
dp2 = list(client["smarteats_delivery"]["partners"].find({}))
print(f"Total delivery_partners: {len(dp1)}")
print(f"Total partners: {len(dp2)}")
print("Sample delivery_partners:")
for d in dp1[:10]:
    print(f"  - ID: {d.get('_id')} | Email: {d.get('email')} | Name: {d.get('name')} | Phone: {d.get('phoneNumber') or d.get('phone')} | Status: {d.get('status')}")

print("Partners collection:")
for p in dp2:
    print(f"  - ID: {p.get('_id')} | {p}")

print("\n==================================================")
print("5. ORDERS ANALYSIS (smarteats_order.orders)")
print("==================================================")
orders = list(client["smarteats_order"]["orders"].find({}))
print(f"Total Orders: {len(orders)}")
order_customer_counts = Counter(o.get("customerEmail") for o in orders)
print("Orders per customer email:", order_customer_counts.most_common(15))
order_rest_counts = Counter(o.get("restaurantId") for o in orders)
print("Orders per restaurant ID:", order_rest_counts.most_common(15))

print("\n==================================================")
print("6. DELIVERIES ANALYSIS (smarteats_delivery.deliveries)")
print("==================================================")
deliveries = list(client["smarteats_delivery"]["deliveries"].find({}))
print(f"Total Deliveries: {len(deliveries)}")
for d in deliveries[:10]:
    print(f"  - ID: {d.get('_id')} | OrderID: {d.get('orderId')} | Status: {d.get('status')} | Customer: {d.get('customerEmail')} | Rider: {d.get('deliveryPartnerEmail')}")

