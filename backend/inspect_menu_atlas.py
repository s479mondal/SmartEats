from pymongo import MongoClient
import dns.resolver

dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
dns.resolver.default_resolver.nameservers = ['8.8.8.8', '8.8.4.4', '1.1.1.1']

uri = "mongodb+srv://soumenmondal741150_db_user:5r47pqpO9Xb2ITI6@smarteatscluster.02gfkuh.mongodb.net/smarteats_restaurant?retryWrites=true&w=majority"
client = MongoClient(uri)
db = client["smarteats_restaurant"]

print("--- ALL RESTAURANTS ---")
for r in db["restaurants"].find({}):
    print(f"ID: {r['_id']}, Name: {r.get('name')}, Owner: {r.get('ownerEmail')}")

print("\n--- ALL MENU ITEMS ---")
for m in db["menu_items"].find({}):
    print(f"Item ID: {m['_id']}, RestaurantID: {m.get('restaurantId')}, Name: {m.get('name')}, Price: {m.get('price')}, Available: {m.get('available')}")
