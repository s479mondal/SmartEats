from pymongo import MongoClient
import dns.resolver

# Configure DNS resolver to avoid Windows DNS timeout issues with dnspython
dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
dns.resolver.default_resolver.nameservers = ['8.8.8.8', '8.8.4.4', '1.1.1.1']

uri = "mongodb+srv://soumenmondal741150_db_user:5r47pqpO9Xb2ITI6@smarteatscluster.02gfkuh.mongodb.net/smarteats_restaurant?retryWrites=true&w=majority"
client = MongoClient(uri)
db = client["smarteats_restaurant"]
restaurants = list(db["restaurants"].find({}))

print(f"Total restaurants found: {len(restaurants)}")
for r in restaurants:
    print({
        "id": str(r.get("_id")),
        "name": r.get("name"),
        "openingTime": r.get("openingTime"),
        "closingTime": r.get("closingTime"),
        "openingTimeMinutes": r.get("openingTimeMinutes"),
        "closingTimeMinutes": r.get("closingTimeMinutes"),
        "open": r.get("open"),
        "status": r.get("status"),
        "approved": r.get("approved")
    })
