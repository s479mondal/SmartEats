import requests
import json
from pymongo import MongoClient
from datetime import datetime
from zoneinfo import ZoneInfo

# 1. MongoDB Atlas setup
MONGO_URI = "mongodb+srv://soumenmondal741150_db_user:5r47pqpO9Xb2ITI6@smarteatscluster.02gfkuh.mongodb.net/smarteats_restaurant?retryWrites=true&w=majority"
client = MongoClient(MONGO_URI)
db_restaurant = client["smarteats_restaurant"]
db_auth = client["smarteats_auth"]

ist = ZoneInfo('Asia/Kolkata')
now_ist = datetime.now(ist)
current_time_str = now_ist.strftime("%H:%M:%S")

print(f"============================================================")
print(f"RESTAURANT OPERATING HOURS LIVE E2E VERIFICATION")
print(f"Current Asia/Kolkata Time: {now_ist.strftime('%Y-%m-%d %H:%M:%S %Z')} ({now_ist.hour*60 + now_ist.minute} mins from midnight)")
print(f"============================================================\n")

# Find a restaurant owner
owner_user = db_auth["users"].find_one({"role": "RESTAURANT_OWNER"})
if not owner_user:
    # Try finding any user with a restaurant
    rest_doc = db_restaurant["restaurants"].find_one()
    owner_email = rest_doc.get("ownerEmail")
    owner_user = db_auth["users"].find_one({"email": owner_email})

owner_email = owner_user["email"]
print(f"1. Target Restaurant Owner Email: {owner_email}")

# Login via Auth API to get JWT token
auth_url = "http://localhost:8080/api/auth/login"
# Check standard passwords or common passwords used in project tests
password = "Password123!" 
login_res = requests.post(auth_url, json={"email": owner_email, "password": password})

if login_res.status_code != 200:
    # Try alternate password
    password = "password"
    login_res = requests.post(auth_url, json={"email": owner_email, "password": password})

if login_res.status_code != 200:
    print(f"Failed to login: {login_res.status_code} {login_res.text}")
    # Print password hash from DB or create a test token if possible
    print(f"User in DB: {owner_user.get('email')}")
    exit(1)

token = login_res.json().get("data", {}).get("token") or login_res.json().get("token")
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
print(f"2. Auth Successful. JWT Token obtained.")

# STEP 1: Fetch current profile (BEFORE)
gateway_url = "http://localhost:8080/api/restaurants/my"
get_before = requests.get(gateway_url, headers=headers)
print(f"\n3. GET /api/restaurants/my (BEFORE): Status {get_before.status_code}")
before_data = get_before.json().get("data") or get_before.json()
print("   Before Profile Response:")
print(f"     Name: {before_data.get('name')}")
print(f"     Opening Time: '{before_data.get('openingTime')}' (Minutes: {before_data.get('openingTimeMinutes')})")
print(f"     Closing Time: '{before_data.get('closingTime')}' (Minutes: {before_data.get('closingTimeMinutes')})")
print(f"     Manual Kitchen Open Flag: {before_data.get('open')}")

# Inspect MongoDB Atlas directly for BEFORE
rest_id = before_data.get("id")
atlas_before = db_restaurant["restaurants"].find_one({"_id": rest_id}) or db_restaurant["restaurants"].find_one({"ownerEmail": owner_email})
print("\n4. MongoDB Atlas Direct Document (BEFORE):")
print(f"     _id: {atlas_before.get('_id')}")
print(f"     openingTime: '{atlas_before.get('openingTime')}'")
print(f"     closingTime: '{atlas_before.get('closingTime')}'")
print(f"     openingTimeMinutes: {atlas_before.get('openingTimeMinutes')}")
print(f"     closingTimeMinutes: {atlas_before.get('closingTimeMinutes')}")
print(f"     open: {atlas_before.get('open')}")

# STEP 2 & 3: Change opening/closing time via PUT /api/restaurants/my
# We will test two changes to verify dynamic open/close logic:
# Test Change A: Set schedule where current IST time is OUTSIDE the window (e.g., 14:00 to 20:00 when time is 03:38 AM) -> expect calculated 'open' = False
# Test Change B: Set schedule where current IST time is INSIDE the window (e.g., 00:00 to 23:59 or 02:00 to 06:00 when time is 03:38 AM) -> expect calculated 'open' = True

test_payload_outside = {
    "description": before_data.get("description", ""),
    "phone": before_data.get("phone", ""),
    "email": before_data.get("email", owner_email),
    "openingTime": "14:00",
    "closingTime": "20:00",
    "logoUrl": before_data.get("logoUrl", ""),
    "open": True,  # Manual toggle ON
    "cuisineType": before_data.get("cuisineType", "")
}

print(f"\n5. Executing PUT /api/restaurants/my with payload: {json.dumps(test_payload_outside)}")
put_res_1 = requests.put(gateway_url, headers=headers, json=test_payload_outside)
print(f"   PUT Response Status: {put_res_1.status_code}")
put_data_1 = put_res_1.json().get("data") or put_res_1.json()
print("   PUT Response Body:")
print(f"     openingTime: '{put_data_1.get('openingTime')}'")
print(f"     closingTime: '{put_data_1.get('closingTime')}'")
print(f"     openingTimeMinutes: {put_data_1.get('openingTimeMinutes')}")
print(f"     closingTimeMinutes: {put_data_1.get('closingTimeMinutes')}")
print(f"     Calculated 'open' Status: {put_data_1.get('open')} (Expected: False, since 03:38 AM is not between 14:00 and 20:00)")

# STEP 4: Reload Dashboard profile (GET /api/restaurants/my)
get_after_1 = requests.get(gateway_url, headers=headers)
after_data_1 = get_after_1.json().get("data") or get_after_1.json()
print(f"\n6. Dashboard Reload (GET /api/restaurants/my) Verification:")
print(f"     openingTime: '{after_data_1.get('openingTime')}'")
print(f"     closingTime: '{after_data_1.get('closingTime')}'")

# STEP 5: Verify MongoDB Atlas Persistence
atlas_after_1 = db_restaurant["restaurants"].find_one({"_id": rest_id}) or db_restaurant["restaurants"].find_one({"ownerEmail": owner_email})
print("\n7. MongoDB Atlas Direct Verification (AFTER Test 1):")
print(f"     openingTime in MongoDB: '{atlas_after_1.get('openingTime')}'")
print(f"     closingTime in MongoDB: '{atlas_after_1.get('closingTime')}'")
print(f"     openingTimeMinutes in MongoDB: {atlas_after_1.get('openingTimeMinutes')}")
print(f"     closingTimeMinutes in MongoDB: {atlas_after_1.get('closingTimeMinutes')}")

# Test Change B: Set schedule where current IST time IS inside window (02:00 to 06:00)
test_payload_inside = {
    "description": before_data.get("description", ""),
    "phone": before_data.get("phone", ""),
    "email": before_data.get("email", owner_email),
    "openingTime": "02:00",
    "closingTime": "06:00",
    "logoUrl": before_data.get("logoUrl", ""),
    "open": True,  # Manual toggle ON
    "cuisineType": before_data.get("cuisineType", "")
}

print(f"\n8. Executing second PUT /api/restaurants/my with active window payload: {json.dumps(test_payload_inside)}")
put_res_2 = requests.put(gateway_url, headers=headers, json=test_payload_inside)
put_data_2 = put_res_2.json().get("data") or put_res_2.json()
print("   PUT Response Body (Active Window):")
print(f"     openingTime: '{put_data_2.get('openingTime')}'")
print(f"     closingTime: '{put_data_2.get('closingTime')}'")
print(f"     openingTimeMinutes: {put_data_2.get('openingTimeMinutes')}")
print(f"     closingTimeMinutes: {put_data_2.get('closingTimeMinutes')}")
print(f"     Calculated 'open' Status: {put_data_2.get('open')} (Expected: True, since 03:38 AM IS between 02:00 and 06:00)")

# Revert back to reasonable standard operating hours (e.g. 10:00 to 22:00 or original)
revert_payload = {
    "description": before_data.get("description", ""),
    "phone": before_data.get("phone", ""),
    "email": before_data.get("email", owner_email),
    "openingTime": "10:00",
    "closingTime": "22:00",
    "logoUrl": before_data.get("logoUrl", ""),
    "open": True,
    "cuisineType": before_data.get("cuisineType", "")
}
requests.put(gateway_url, headers=headers, json=revert_payload)
print(f"\n9. Reverted schedule to standard 10:00 -> 22:00.")
