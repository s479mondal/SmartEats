import requests

BASE_URL = "http://localhost:8080"

login_res = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "soumen.mondal2025@vitstudent.ac.in", "password": "password123"})
if login_res.status_code != 200:
    login_res = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "soumen.mondal2025@vitstudent.ac.in", "password": "admin123"})

print("TARA MA owner login status:", login_res.status_code)
token = login_res.json()["data"]["token"]
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

order_id = "6aac45a63459f2214b37a982"

# 1. CORS Preflight Check
options_res = requests.options(
    f"{BASE_URL}/api/orders/my/orders/{order_id}/accept",
    headers={
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "PATCH",
        "Access-Control-Request-Headers": "authorization,content-type"
    }
)
print(f"CORS Preflight Status: {options_res.status_code}")
print(f"CORS Allow Methods: {options_res.headers.get('Access-Control-Allow-Methods')}")

# 2. Actual PATCH call
patch_res = requests.patch(f"{BASE_URL}/api/orders/my/orders/{order_id}/accept", headers=headers)
print(f"\nPATCH accept status: {patch_res.status_code}")
print(f"PATCH accept body: {patch_res.text}")
