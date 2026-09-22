import requests
import json
from pymongo import MongoClient

MONGO_URI = "mongodb+srv://soumenmondal741150_db_user:5r47pqpO9Xb2ITI6@smarteatscluster.02gfkuh.mongodb.net/smarteats?retryWrites=true&w=majority"
client = MongoClient(MONGO_URI)
db_restaurant = client["smarteats_restaurant"]

# Login as customer
auth_url = "http://localhost:8080/api/auth/login"
res = requests.post(auth_url, json={"email": "s1@gmail.com", "password": "admin123"})
token = res.json().get("data", {}).get("token") or res.json().get("token")
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Find all restaurants and their approved/open status
for r in db_restaurant["restaurants"].find():
    print("="*60)
    print(f"Restaurant: {r.get('name')} (_id: {r.get('_id')})")
    print(f"  Owner: {r.get('ownerEmail')}")
    print(f"  Approved: {r.get('approved')}, Status: {r.get('status')}")
    print(f"  Schedule: {r.get('openingTime')} ({r.get('openingTimeMinutes')}) -> {r.get('closingTime')} ({r.get('closingTimeMinutes')})")
    print(f"  Manual open: {r.get('open')}")
    
    # Check menu items
    menu_items = list(db_restaurant["menu_items"].find({"restaurantId": str(r.get('_id'))}))
    print(f"  Menu items count: {len(menu_items)}")
    for m in menu_items:
        print(f"    - {m.get('name')} (id: {m.get('_id')}, price: {m.get('price')}, avail: {m.get('available')}, qty: {m.get('availableQuantity')})")

    # Call restaurant public API
    api_res = requests.get(f"http://localhost:8080/api/restaurants/{r.get('_id')}")
    if api_res.status_code == 200:
        d = api_res.json().get("data", {})
        print(f"  API Computed open boolean: {d.get('open')}")
    else:
        print(f"  API status: {api_res.status_code}")
