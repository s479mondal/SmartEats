import requests
import json

BASE_URL = "http://localhost:8080"

def test_flow():
    print("=== Testing Complete Online Payment Flow ===")
    
    # 1. Login
    login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "s1@gmail.com", "password": "password123"})
    if login_resp.status_code != 200:
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "s1@gmail.com", "password": "admin123"})
    
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    token = login_resp.json()["data"]["token"]
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    print("1. Customer login successful")

    # 2. Get Dada Boudi Biryani menu & inventory
    rest_id = "6ab060f54e48f1061d3e2629"
    rest_resp = requests.get(f"{BASE_URL}/api/restaurants/{rest_id}")
    assert rest_resp.status_code == 200
    rest_data = rest_resp.json()["data"]
    print(f"2. Restaurant: {rest_data['name']} (Open: {rest_data.get('open')}, Status: {rest_data.get('status')})")

    menu_resp = requests.get(f"{BASE_URL}/api/restaurants/{rest_id}/menu")
    assert menu_resp.status_code == 200
    menu_items = menu_resp.json()["data"]
    item = menu_items[0]
    print(f"   Selected Item: {item['name']} | Price: INR {item['price']} | Portions: {item.get('availableQuantity')}")

    # 3. Simulate Empty Cart (cleared redis, empty payload)
    requests.delete(f"{BASE_URL}/api/orders/cart", headers=headers)
    empty_res = requests.post(f"{BASE_URL}/api/orders/payment/create-order", headers=headers, json={})
    print(f"3. Empty cart test response: HTTP {empty_res.status_code}")
    print(f"   Response payload: {empty_res.text}")
    assert empty_res.status_code == 400
    assert "Shopping cart is empty" in empty_res.json().get("message", "")

    # 4. Simulate Frontend Online Checkout with Cart Payload
    cart_payload = {
        "restaurantId": rest_id,
        "items": [
            {
                "menuItemId": item["id"],
                "name": item["name"],
                "price": item["price"],
                "quantity": 1
            }
        ]
    }
    import time
    idempotency_key = f"test-idemp-{int(time.time() * 1000)}"
    headers["Idempotency-Key"] = idempotency_key
    
    checkout_res = requests.post(f"{BASE_URL}/api/orders/payment/create-order", headers=headers, json=cart_payload)
    print(f"4. Online Payment checkout response: HTTP {checkout_res.status_code}")
    print(f"   Response payload: {checkout_res.text}")
    assert checkout_res.status_code == 201, f"Expected 201, got {checkout_res.status_code}"
    
    order_data = checkout_res.json()["data"]
    assert order_data["razorpayOrderId"].startswith("order_")
    assert order_data["amount"] == item["price"]
    assert order_data["keyId"] is not None
    print(f"   SUCCESS! Razorpay Order Created: {order_data['razorpayOrderId']}")
    print(f"   Order ID: {order_data['orderId']}")
    print(f"   Key ID: {order_data['keyId']}")
    print(f"   Amount in Paise: {order_data['amountInPaise']}")

    # 5. Check order status in database via order API
    order_status_res = requests.get(f"{BASE_URL}/api/orders/{order_data['orderId']}", headers=headers)
    assert order_status_res.status_code == 200
    order_info = order_status_res.json()["data"]
    print(f"5. Stored Order Verification:")
    print(f"   Status: {order_info['status']}")
    print(f"   Payment Status: {order_info['paymentStatus']}")
    print(f"   Payment Method: {order_info['paymentMethod']}")
    print(f"   Razorpay Order ID: {order_info['razorpayOrderId']}")
    print("=== Complete Online Payment Flow Successfully Verified ===")

if __name__ == "__main__":
    test_flow()
