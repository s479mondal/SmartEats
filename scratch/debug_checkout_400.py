import requests
import json
from pymongo import MongoClient

MONGO_URI = "mongodb+srv://soumenmondal741150_db_user:5r47pqpO9Xb2ITI6@smarteatscluster.02gfkuh.mongodb.net/smarteats?retryWrites=true&w=majority"
client = MongoClient(MONGO_URI)
db_auth = client["smarteats_auth"]
db_restaurant = client["smarteats_restaurant"]

user = db_auth["users"].find_one({"email": "s1@gmail.com"})
print(f"User s1@gmail.com in DB: {user}")

# Login
auth_url = "http://localhost:8080/api/auth/login"
for pwd in ["Password123!", "password", "123456", "admin123"]:
    res = requests.post(auth_url, json={"email": "s1@gmail.com", "password": pwd})
    if res.status_code == 200:
        token = res.json().get("data", {}).get("token") or res.json().get("token")
        print(f"Logged in with password: {pwd}")
        break
else:
    print(f"Could not log in with common passwords. Status: {res.status_code} {res.text}")
    exit(1)

headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# 1. Get Cart
cart_res = requests.get("http://localhost:8080/api/orders/cart", headers=headers)
print(f"\n--- CART RESPONSE ({cart_res.status_code}) ---")
print(cart_res.text)
cart_data = cart_res.json().get("data") or cart_res.json()

# 2. If cart has restaurant, check restaurant details
rest_id = cart_data.get("restaurantId") if isinstance(cart_data, dict) else None
print(f"\n--- RESTAURANT IN CART: {rest_id} ---")
if rest_id:
    rest_res = requests.get(f"http://localhost:8080/api/restaurants/{rest_id}")
    print(f"Restaurant API Status: {rest_res.status_code}")
    print(f"Restaurant Details: {rest_res.text}")
    
    # Check inventory reserve endpoint directly
    items = cart_data.get("items", [])
    inv_payload = {"items": [{"menuItemId": it["menuItemId"], "quantity": it["quantity"]} for it in items]}
    inv_res = requests.post(f"http://localhost:8082/api/restaurants/{rest_id}/inventory/reserve", json=inv_payload)
    print(f"Direct inventory reserve test: Status {inv_res.status_code}, Body: {inv_res.text}")

# 3. Test POST /api/orders/payment/create-order
create_order_res = requests.post(
    "http://localhost:8080/api/orders/payment/create-order",
    headers={**headers, "Idempotency-Key": "test-debug-key-001"}
)
print(f"\n--- CREATE PAYMENT ORDER RESPONSE ({create_order_res.status_code}) ---")
print(f"Headers: {create_order_res.headers}")
print(f"Body: {create_order_res.text}")
