import winreg

def set_user_env(name, value):
    key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Environment", 0, winreg.KEY_SET_VALUE)
    winreg.SetValueEx(key, name, 0, winreg.REG_SZ, value)
    winreg.CloseKey(key)
    print(f"Set {name} successfully!")

env_vars = {
    "MONGODB_USER": "soumenmondal741150_db_user",
    "MONGODB_PASSWORD": "5r47pqpO9Xb2ITI6",
    "MONGODB_URI": "mongodb+srv://soumenmondal741150_db_user:5r47pqpO9Xb2ITI6@smarteatscluster.02gfkuh.mongodb.net/smarteats?retryWrites=true&w=majority",
    "MONGODB_URI_AUTH": "mongodb+srv://soumenmondal741150_db_user:5r47pqpO9Xb2ITI6@smarteatscluster.02gfkuh.mongodb.net/smarteats_auth?retryWrites=true&w=majority",
    "MONGODB_URI_RESTAURANT": "mongodb+srv://soumenmondal741150_db_user:5r47pqpO9Xb2ITI6@smarteatscluster.02gfkuh.mongodb.net/smarteats_restaurant?retryWrites=true&w=majority",
    "MONGODB_URI_ORDER": "mongodb+srv://soumenmondal741150_db_user:5r47pqpO9Xb2ITI6@smarteatscluster.02gfkuh.mongodb.net/smarteats_order?retryWrites=true&w=majority",
    "MONGODB_URI_DELIVERY": "mongodb+srv://soumenmondal741150_db_user:5r47pqpO9Xb2ITI6@smarteatscluster.02gfkuh.mongodb.net/smarteats_delivery?retryWrites=true&w=majority",
    "MONGODB_URI_NOTIFICATION": "mongodb+srv://soumenmondal741150_db_user:5r47pqpO9Xb2ITI6@smarteatscluster.02gfkuh.mongodb.net/smarteats_notification?retryWrites=true&w=majority",
    "KAFKA_SERVERS": "localhost:9092",
    "REDIS_HOST": "localhost"
}

for k, v in env_vars.items():
    set_user_env(k, v)

print("All user environment variables set successfully!")
