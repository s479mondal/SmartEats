import requests
import json

# 1. Login as s1@gmail.com
login_url = "http://localhost:8080/api/auth/login"
resp = requests.post(login_url, json={"email": "s1@gmail.com", "password": "password123"})
if resp.status_code != 200:
    resp = requests.post(login_url, json={"email": "s1@gmail.com", "password": "admin123"})
print(f"Login status: {resp.status_code}")
token = resp.json().get("data", {}).get("token")
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

# 2. Clear cart in redis first via DELETE /api/orders/cart
clear_resp = requests.delete("http://localhost:8080/api/orders/cart", headers=headers)
print("Clear cart response:", clear_resp.status_code, clear_resp.text)

# 3. Test create-order with empty cart (no body)
empty_resp = requests.post("http://localhost:8080/api/orders/payment/create-order", headers=headers, json={})
print("\nEmpty cart test (should have detailed error message):")
print(f"Status: {empty_resp.status_code}")
print(f"Body: {empty_resp.text}")

# 4. Test create-order WITH cart body
cart_body = {
    "restaurantId": "6ab060f54e48f1061d3e2629",
    "items": [
        {
            "menuItemId": "6ab0614c4e48f1061d3e262a",
            "name": "Chicken Biryani",
            "price": 200.0,
            "quantity": 1
        }
    ]
}
success_resp = requests.post("http://localhost:8080/api/orders/payment/create-order", headers=headers, json=cart_body)
print("\nCart body provided test:")
print(f"Status: {success_resp.status_code}")
print(f"Body: {success_resp.text}")
