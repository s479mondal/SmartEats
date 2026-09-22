from pymongo import MongoClient

client = MongoClient(open('.env').read().split('MONGODB_URI=')[1].split('\n')[0].strip())
orders = list(client['smarteats_order']['orders'].find({}))

print(f"Total orders in DB: {len(orders)}")
for o in orders:
    print(f"ID: {o.get('_id')} | Status: {o.get('status')} | Rest: {o.get('restaurantId')} | DelLat: {o.get('deliveryLatitude')} | DelLng: {o.get('deliveryLongitude')} | Cust: {o.get('customerEmail')}")
