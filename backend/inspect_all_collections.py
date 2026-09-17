from pymongo import MongoClient
import dns.resolver

dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
dns.resolver.default_resolver.nameservers = ['8.8.8.8', '8.8.4.4', '1.1.1.1']

uri = "mongodb+srv://soumenmondal741150_db_user:5r47pqpO9Xb2ITI6@smarteatscluster.02gfkuh.mongodb.net/?retryWrites=true&w=majority"
client = MongoClient(uri)

for db_name in client.list_database_names():
    if db_name in ['admin', 'local', 'config']:
        continue
    db = client[db_name]
    print(f"\nDatabase: {db_name}")
    for col_name in db.list_collection_names():
        count = db[col_name].count_documents({})
        print(f"  Collection: {col_name} (count: {count})")
        if "menu" in col_name.lower():
            for doc in db[col_name].find({}):
                print(f"    Menu doc: {doc}")
