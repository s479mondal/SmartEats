import requests
import json

BASE_URL = "http://localhost:8080/api"

# Login as customer
login_payload = {
    "email": "customer@smarteats.com",
    "password": "Password@123"
}

login_res = requests.post(f"{BASE_URL}/auth/login", json=login_payload)
print(f"Customer Login Status: {login_res.status_code}")
if login_res.status_code != 200:
    print(f"Login failed: {login_res.text}")
    exit(1)

token = login_res.json().get('data', {}).get('token')
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

# 1. Fetch restaurants to get IDs
rest_res = requests.get(f"{BASE_URL}/restaurants", headers=headers)
restaurants = rest_res.json().get('data', [])

closed_rest = None
open_rest = None

for r in restaurants:
    if not r.get('open') and closed_rest is None:
        closed_rest = r
    if r.get('open') and open_rest is None:
        open_rest = r

print(f"\n[TARGET 1] Closed Restaurant: '{closed_rest.get('name')}' (ID: {closed_rest.get('id')}, open={closed_rest.get('open')})")
print(f"[TARGET 2] Open Restaurant: '{open_rest.get('name')}' (ID: {open_rest.get('id')}, open={open_rest.get('open')})")

# TEST 1: Attempt to place order for CLOSED restaurant
if closed_rest:
    requests.delete(f"{BASE_URL}/orders/cart", headers=headers)
    
    add_item_payload = {
        "menuItemId": "item_closed_1",
        "name": "Closed Restaurant Dish",
        "quantity": 1,
        "price": 200.0
    }
    requests.post(f"{BASE_URL}/orders/cart?restaurantId={closed_rest.get('id')}", json=add_item_payload, headers=headers)
    
    order_res = requests.post(f"{BASE_URL}/orders/checkout", headers=headers)
    print(f"\nPlace Order on CLOSED restaurant Status Code: {order_res.status_code}")
    print(f"Response: {order_res.text}")
    assert order_res.status_code == 400, f"Expected 400 but got {order_res.status_code}"
    print(">>> [VERIFIED] Order placement for CLOSED restaurant is rejected with 400 BadRequestException!")

# TEST 2: Attempt to place order for OPEN restaurant
if open_rest:
    requests.delete(f"{BASE_URL}/orders/cart", headers=headers)
    
    add_item_payload = {
        "menuItemId": "item_open_1",
        "name": "Midnight Thali",
        "quantity": 1,
        "price": 300.0
    }
    requests.post(f"{BASE_URL}/orders/cart?restaurantId={open_rest.get('id')}", json=add_item_payload, headers=headers)
    
    order_res = requests.post(f"{BASE_URL}/orders/checkout", headers=headers)
    print(f"\nPlace Order on OPEN restaurant Status Code: {order_res.status_code}")
    print(f"Response: {order_res.text}")
    assert order_res.status_code in [200, 201], f"Expected 200/201 but got {order_res.status_code}"
    print(">>> [VERIFIED] Order placement for OPEN restaurant SUCCEEDED!")
