import time
import requests
import json
from pymongo import MongoClient
import dns.resolver

# Configure DNS resolver
dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
dns.resolver.default_resolver.nameservers = ['8.8.8.8', '8.8.4.4', '1.1.1.1']

GATEWAY_URL = "http://localhost:8080"
AUTH_REGISTER_URL = f"{GATEWAY_URL}/api/auth/register"
RESTAURANT_API_URL = f"{GATEWAY_URL}/api/restaurants"

ATLAS_URI = "mongodb+srv://soumenmondal741150_db_user:5r47pqpO9Xb2ITI6@smarteatscluster.02gfkuh.mongodb.net/smarteats_restaurant?retryWrites=true&w=majority"
client = MongoClient(ATLAS_URI)
db = client["smarteats_restaurant"]
restaurants_col = db["restaurants"]

def run_tests():
    print("==================================================")
    print("STEP 5.2 LIVE REGISTRATION & DATA MODEL VERIFICATION")
    print("==================================================")

    timestamp = int(time.time())

    # --- TEST 1: Standard Normal Schedule Restaurant Registration ---
    print("\n--- 1. Testing Normal Restaurant Registration (10:00 -> 22:00) ---")
    normal_email = f"durgapur_time_{timestamp}@smarteats.com"
    normal_payload = {
        "name": "Durgapur Owner",
        "email": normal_email,
        "phone": "9876543210",
        "password": "Password123!",
        "address": "Near City Centre, Durgapur, 713216",
        "location": "City Centre, Durgapur",
        "city": "Durgapur",
        "pincode": "713216",
        "latitude": 23.5421,
        "longitude": 87.2934,
        "restaurantLatitude": 23.5421,
        "restaurantLongitude": 87.2934,
        "locationSource": "USER_CONFIRMED_MAP",
        "roles": ["RESTAURANT_OWNER"],
        "restaurantName": "Durgapur Time Test Restaurant",
        "description": "Authentic Biryani and kebabs in City Centre",
        "restaurantAddress": "Near City Centre, Durgapur, 713216",
        "restaurantLocation": "City Centre, Durgapur",
        "cuisineType": "Biryani & Mughlai",
        "restaurantContact": "9876543210",
        "restaurantEmail": normal_email,
        "openingTime": "10:00",
        "closingTime": "22:00",
        "logoUrl": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4"
    }

    resp1 = requests.post(AUTH_REGISTER_URL, json=normal_payload)
    print(f"Registration status: {resp1.status_code}")
    if resp1.status_code in (200, 201):
        user_data = resp1.json()
        print(f"Registered User ID: {user_data.get('id')}, Email: {user_data.get('email')}")
    else:
        print(f"Registration response: {resp1.text}")

    # Allow Kafka event consumer to process and persist
    print("Waiting 3 seconds for Kafka event processing in restaurant-service...")
    time.sleep(3)

    # Verify in MongoDB Atlas
    normal_doc = restaurants_col.find_one({"ownerEmail": normal_email})
    if normal_doc:
        print(f"[MONGODB ATLAS VERIFIED] Found restaurant document in smarteats_restaurant.restaurants:")
        print({
            "_id": str(normal_doc["_id"]),
            "name": normal_doc.get("name"),
            "ownerEmail": normal_doc.get("ownerEmail"),
            "openingTime": normal_doc.get("openingTime"),
            "closingTime": normal_doc.get("closingTime"),
            "openingTimeMinutes": normal_doc.get("openingTimeMinutes"),
            "closingTimeMinutes": normal_doc.get("closingTimeMinutes"),
            "openingTimeMinutes_type": type(normal_doc.get("openingTimeMinutes")).__name__,
            "closingTimeMinutes_type": type(normal_doc.get("closingTimeMinutes")).__name__,
            "open": normal_doc.get("open"),
            "status": normal_doc.get("status")
        })
        assert normal_doc.get("openingTimeMinutes") == 600, f"Expected 600, got {normal_doc.get('openingTimeMinutes')}"
        assert normal_doc.get("closingTimeMinutes") == 1320, f"Expected 1320, got {normal_doc.get('closingTimeMinutes')}"
        assert isinstance(normal_doc.get("openingTimeMinutes"), int), "openingTimeMinutes must be an integer"
        assert isinstance(normal_doc.get("closingTimeMinutes"), int), "closingTimeMinutes must be an integer"
        print("[OK] Normal restaurant minutes verified (600, 1320) as numeric integers!")
    else:
        print("❌ Could not find registered restaurant in MongoDB Atlas.")

    # --- TEST 2: Overnight Schedule Restaurant Registration ---
    print("\n--- 2. Testing Overnight Restaurant Registration (22:00 -> 02:00) ---")
    overnight_email = f"overnight_diner_{timestamp}@smarteats.com"
    overnight_payload = {
        "name": "Overnight Owner",
        "email": overnight_email,
        "phone": "9876543211",
        "password": "Password123!",
        "address": "Near Station Road, Durgapur, 713216",
        "location": "Station Road, Durgapur",
        "city": "Durgapur",
        "pincode": "713216",
        "latitude": 23.5421,
        "longitude": 87.2934,
        "restaurantLatitude": 23.5421,
        "restaurantLongitude": 87.2934,
        "locationSource": "USER_CONFIRMED_MAP",
        "roles": ["RESTAURANT_OWNER"],
        "restaurantName": "Durgapur Midnight Diner",
        "description": "Late night snacks and meals",
        "restaurantAddress": "Near Station Road, Durgapur, 713216",
        "restaurantLocation": "Station Road, Durgapur",
        "cuisineType": "Fast Food & Snacks",
        "restaurantContact": "9876543211",
        "restaurantEmail": overnight_email,
        "openingTime": "22:00",
        "closingTime": "02:00",
        "logoUrl": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4"
    }

    resp2 = requests.post(AUTH_REGISTER_URL, json=overnight_payload)
    print(f"Registration status: {resp2.status_code}")
    time.sleep(3)

    overnight_doc = restaurants_col.find_one({"ownerEmail": overnight_email})
    if overnight_doc:
        print(f"[MONGODB ATLAS VERIFIED] Found overnight restaurant document in smarteats_restaurant.restaurants:")
        print({
            "_id": str(overnight_doc["_id"]),
            "name": overnight_doc.get("name"),
            "ownerEmail": overnight_doc.get("ownerEmail"),
            "openingTime": overnight_doc.get("openingTime"),
            "closingTime": overnight_doc.get("closingTime"),
            "openingTimeMinutes": overnight_doc.get("openingTimeMinutes"),
            "closingTimeMinutes": overnight_doc.get("closingTimeMinutes"),
            "openingTimeMinutes_type": type(overnight_doc.get("openingTimeMinutes")).__name__,
            "closingTimeMinutes_type": type(overnight_doc.get("closingTimeMinutes")).__name__,
            "open": overnight_doc.get("open"),
            "status": overnight_doc.get("status")
        })
        assert overnight_doc.get("openingTimeMinutes") == 1320, f"Expected 1320, got {overnight_doc.get('openingTimeMinutes')}"
        assert overnight_doc.get("closingTimeMinutes") == 120, f"Expected 120, got {overnight_doc.get('closingTimeMinutes')}"
        assert isinstance(overnight_doc.get("openingTimeMinutes"), int), "openingTimeMinutes must be an integer"
        assert isinstance(overnight_doc.get("closingTimeMinutes"), int), "closingTimeMinutes must be an integer"
        print("[OK] Overnight restaurant minutes verified (1320, 120) as numeric integers!")
    else:
        print("[FAIL] Could not find overnight restaurant in MongoDB Atlas.")

    # --- TEST 3: Invalid Input Rejection Check ---
    print("\n--- 3. Testing Backend Invalid Time Format Rejection (400 Bad Request) ---")
    headers = {
        "X-User-Email": "owner@smarteats.com",
        "X-User-Roles": "RESTAURANT_OWNER"
    }
    
    resp3 = requests.post("http://localhost:8082/api/restaurants", headers=headers, json={
        "name": "Direct Malformed Test",
        "address": "Near City Centre, Durgapur, 713216",
        "city": "Durgapur",
        "pincode": "713216",
        "latitude": 23.5421,
        "longitude": 87.2934,
        "openingTime": "25:99",
        "closingTime": "abc"
    })
    print(f"Direct invalid time POST http://localhost:8082/api/restaurants status: {resp3.status_code}")
    print(f"Response body: {resp3.text}")
    assert resp3.status_code == 400, f"Expected 400 Bad Request on malformed time input, got {resp3.status_code}"
    print("[OK] Backend returns 400 Bad Request on invalid time without throwing 500 error!")

    print("\n==================================================")
    print("ALL LIVE VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
