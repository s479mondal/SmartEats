import requests
import json

# Login as customer s1@gmail.com
auth_url = "http://localhost:8080/api/auth/login"
res = requests.post(auth_url, json={"email": "s1@gmail.com", "password": "admin123"})
token = res.json().get("data", {}).get("token") or res.json().get("token")
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Restaurant: Dada Boudi Biryani (_id: 6ab060f54e48f1061d3e2629)
# Menu Item: Chicken Biryani (_id: 6ab0614c4e48f1061d3e262a, price: 200.0)
rest_id = "6ab060f54e48f1061d3e2629"
item_id = "6ab0614c4e48f1061d3e262a"

# 1. Clear cart
del_res = requests.delete("http://localhost:8080/api/orders/cart", headers=headers)
print("Clear cart:", del_res.status_code)

# 2. Add item to cart
add_payload = {
    "menuItemId": item_id,
    "name": "Chicken Biryani",
    "quantity": 1,
    "price": 200.0
}
add_res = requests.post(f"http://localhost:8080/api/orders/cart?restaurantId={rest_id}", headers=headers, json=add_payload)
print("Add to cart status:", add_res.status_code)
print("Cart data:", add_res.text)

# 3. Call create-payment-order
create_res = requests.post(
    "http://localhost:8080/api/orders/payment/create-order",
    headers={**headers, "Idempotency-Key": "test-key-populated-cart-001"}
)
print("\n--- CREATE PAYMENT ORDER WITH POPULATED CART ---")
print("Status Code:", create_res.status_code)
print("Headers:", create_res.headers)
print("Body:", create_res.text)
