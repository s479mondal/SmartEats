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

orders = list(client["smarteats_order"]["orders"].find({}))
deliveries = list(client["smarteats_delivery"]["deliveries"].find({}))
notifications = list(client["smarteats_notification"]["notifications"].find({}))

print("=== ORDERS BREAKDOWN ===")
genuine_cust_emails = {
    'admin@smarteats.com', 'ngo@smarteats.com', 'customer@smarteats.com', 
    'restaurant@smarteats.com', 'driver@smarteats.com', 'clouduser@smarteats.com', 
    's479mondal@gmail.com', 's4mondal@gmail.com', 'priya.customer@smarteats.com', 
    'marco.pizza@smarteats.com', 'ajay.rider@smarteats.com', 'ananya.ngo@smarteats.com', 
    'd@gmail.com', 's7mondal@gmail.com', 'customer2@smarteats.com', 's@gmail.com', 
    'realcustomer_step8@smarteats.com', 'testcustomer2026@smarteats.com', 
    'soumen_pin_test_final@smarteats.com', 's1@gmail.com', 
    'soumen.mondal2025@vitstudent.ac.in', 'g@gmail.com', 'r@gmail.com'
}

genuine_orders = []
test_orders = []

for o in orders:
    c_email = o.get("customerEmail", "").lower().strip()
    idemp = o.get("idempotencyKey", "")
    rest_id = o.get("restaurantId", "")
    
    is_test = False
    if c_email not in genuine_cust_emails:
        is_test = True
    elif "test" in idemp.lower() or "idemp" in idemp.lower():
        is_test = True
        
    if is_test:
        test_orders.append(o)
    else:
        genuine_orders.append(o)

print(f"Total Orders: {len(orders)}")
print(f"Genuine Orders: {len(genuine_orders)}")
print(f"Test Orders: {len(test_orders)}")

print("\nSample genuine orders:")
for o in genuine_orders[:10]:
    print(f"  - ID: {o.get('_id')} | Customer: {o.get('customerEmail')} | Rest: {o.get('restaurantId')} | Amount: {o.get('totalAmount')} | Status: {o.get('status')} | Idemp: {o.get('idempotencyKey')}")

print("\nSample test orders:")
for o in test_orders[:10]:
    print(f"  - ID: {o.get('_id')} | Customer: {o.get('customerEmail')} | Rest: {o.get('restaurantId')} | Amount: {o.get('totalAmount')} | Status: {o.get('status')} | Idemp: {o.get('idempotencyKey')}")

print("\n=== DELIVERIES BREAKDOWN ===")
genuine_deliveries = []
test_deliveries = []
test_order_ids = {str(o.get("_id")) for o in test_orders}

for d in deliveries:
    order_id = str(d.get("orderId"))
    c_email = d.get("customerEmail", "").lower().strip()
    r_email = d.get("deliveryPartnerEmail", "").lower().strip()
    
    if order_id in test_order_ids or c_email not in genuine_cust_emails or "test" in r_email or re.search(r'\d{8,}', r_email):
        test_deliveries.append(d)
    else:
        genuine_deliveries.append(d)

print(f"Total Deliveries: {len(deliveries)}")
print(f"Genuine Deliveries: {len(genuine_deliveries)}")
print(f"Test Deliveries: {len(test_deliveries)}")

print("\n=== NOTIFICATIONS BREAKDOWN ===")
genuine_notifications = []
test_notifications = []

for n in notifications:
    r_email = n.get("recipientEmail", "").lower().strip()
    order_id = str(n.get("orderId", "")).replace('"', '')
    
    if r_email not in genuine_cust_emails or order_id in test_order_ids:
        test_notifications.append(n)
    else:
        genuine_notifications.append(n)

print(f"Total Notifications: {len(notifications)}")
print(f"Genuine Notifications: {len(genuine_notifications)}")
print(f"Test Notifications: {len(test_notifications)}")
