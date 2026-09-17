import os
import pymongo
import bcrypt

uri = os.environ.get('MONGODB_URI_AUTH')
client = pymongo.MongoClient(uri)
db = client['smarteats_auth']

hashed = bcrypt.hashpw(b'Password@123', bcrypt.gensalt()).decode('utf-8')
db.users.update_one(
    {'email': 'customer@smarteats.com'},
    {'$set': {
        'password': hashed,
        'customerLatitude': 12.9716,
        'customerLongitude': 77.5946
    }}
)
print("Updated customer@smarteats.com with fresh bcrypt password!")
