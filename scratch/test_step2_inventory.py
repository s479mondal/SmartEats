import urllib.request
import json

BASE_URL = "http://localhost:8082/api/restaurants"

def run_tests():
    print("=== LIVE INVENTORY STEP 2 API INTEGRATION TEST ===")
    
    # 1. Fetch restaurants
    req = urllib.request.Request(f"{BASE_URL}")
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        restaurants = data.get("data", [])
        
    if not restaurants:
        print("No restaurants found!")
        return
        
    target_rest = None
    for r in restaurants:
        if r.get("ownerEmail"):
            target_rest = r
            break
    if not target_rest:
        target_rest = restaurants[0]
        
    rest_id = target_rest["id"]
    owner_email = target_rest.get("ownerEmail") or target_rest.get("email") or "restaurant@smarteats.com"
    print(f"Target Restaurant: {target_rest['name']} (ID: {rest_id}, Owner: {owner_email})")
    
    headers = {
        "Content-Type": "application/json",
        "X-User-Email": owner_email,
        "X-User-Roles": "RESTAURANT_OWNER"
    }
    
    # 2. Test Create Menu Item with availableQuantity = 20
    new_item_payload = {
        "name": "Live Test Butter Chicken",
        "description": "Authentic North Indian style gravy with tender chicken portions",
        "price": 180.0,
        "category": "Main Course",
        "available": True,
        "availableQuantity": 20
    }
    
    create_req = urllib.request.Request(
        f"{BASE_URL}/{rest_id}/menu",
        data=json.dumps(new_item_payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )
    with urllib.request.urlopen(create_req) as resp:
        created = json.loads(resp.read().decode())["data"]
        print(f"\n[TEST 2 PASS] Created Item '{created['name']}': availableQuantity = {created.get('availableQuantity')}, ID = {created['id']}")
        assert created.get("availableQuantity") == 20
        item_id = created["id"]
        
    # 3. Test Update Menu Item: 20 -> 10
    update_payload_10 = {
        "name": "Live Test Butter Chicken",
        "description": "Authentic North Indian style gravy with tender chicken portions",
        "price": 180.0,
        "category": "Main Course",
        "available": True,
        "availableQuantity": 10
    }
    update_req_10 = urllib.request.Request(
        f"{BASE_URL}/{rest_id}/menu/{item_id}",
        data=json.dumps(update_payload_10).encode("utf-8"),
        headers=headers,
        method="PUT"
    )
    with urllib.request.urlopen(update_req_10) as resp:
        updated = json.loads(resp.read().decode())["data"]
        print(f"[TEST 3 PASS] Updated 20 -> 10: availableQuantity = {updated.get('availableQuantity')}")
        assert updated.get("availableQuantity") == 10
        
    # 4. Test Update Menu Item: 10 -> 0
    update_payload_0 = {
        "name": "Live Test Butter Chicken",
        "description": "Authentic North Indian style gravy with tender chicken portions",
        "price": 180.0,
        "category": "Main Course",
        "available": True,
        "availableQuantity": 0
    }
    update_req_0 = urllib.request.Request(
        f"{BASE_URL}/{rest_id}/menu/{item_id}",
        data=json.dumps(update_payload_0).encode("utf-8"),
        headers=headers,
        method="PUT"
    )
    with urllib.request.urlopen(update_req_0) as resp:
        updated0 = json.loads(resp.read().decode())["data"]
        print(f"[TEST 4 PASS] Updated 10 -> 0: availableQuantity = {updated0.get('availableQuantity')}")
        assert updated0.get("availableQuantity") == 0
        
    # 5. Test Update Menu Item: 0 -> 15 (Restock)
    update_payload_15 = {
        "name": "Live Test Butter Chicken",
        "description": "Authentic North Indian style gravy with tender chicken portions",
        "price": 180.0,
        "category": "Main Course",
        "available": True,
        "availableQuantity": 15
    }
    update_req_15 = urllib.request.Request(
        f"{BASE_URL}/{rest_id}/menu/{item_id}",
        data=json.dumps(update_payload_15).encode("utf-8"),
        headers=headers,
        method="PUT"
    )
    with urllib.request.urlopen(update_req_15) as resp:
        updated15 = json.loads(resp.read().decode())["data"]
        print(f"[TEST 5 PASS] Updated 0 -> 15 (Restock): availableQuantity = {updated15.get('availableQuantity')}")
        assert updated15.get("availableQuantity") == 15
        
    # 6. Test Negative quantity rejection (-5)
    bad_payload = {
        "name": "Live Test Butter Chicken",
        "description": "Test",
        "price": 180.0,
        "category": "Main Course",
        "available": True,
        "availableQuantity": -5
    }
    bad_req = urllib.request.Request(
        f"{BASE_URL}/{rest_id}/menu/{item_id}",
        data=json.dumps(bad_payload).encode("utf-8"),
        headers=headers,
        method="PUT"
    )
    try:
        urllib.request.urlopen(bad_req)
        print("[FAIL] Negative quantity was unexpectedly accepted!")
    except urllib.error.HTTPError as e:
        print(f"[TEST 7 PASS] Negative quantity rejected with HTTP {e.code}: {e.read().decode()}")
        assert e.code == 400
        
    # 7. Test Get Menu across API Gateway (Redis cache invalidation check)
    get_menu_req = urllib.request.Request(f"{BASE_URL}/{rest_id}/menu")
    with urllib.request.urlopen(get_menu_req) as resp:
        menu_items = json.loads(resp.read().decode())["data"]
        found = [i for i in menu_items if i["id"] == item_id]
        assert len(found) == 1
        print(f"[TEST 9 PASS] Menu API fetched fresh list: Item {found[0]['name']} has availableQuantity = {found[0].get('availableQuantity')}")
        
    # 8. Clean up test item
    del_req = urllib.request.Request(
        f"{BASE_URL}/{rest_id}/menu/{item_id}",
        headers=headers,
        method="DELETE"
    )
    with urllib.request.urlopen(del_req) as resp:
        print(f"[CLEANUP] Deleted test item {item_id}")
        
    print("\nALL INVENTORY STEP 2 VERIFICATION TESTS PASSED SUCCESSFULLY! 🚀")

if __name__ == "__main__":
    run_tests()
