# MongoDB Atlas Connection Guide

This guide details how to set up a MongoDB Atlas cluster and connect it to the **SmartEats** platform (both the Spring Boot backend and the Python ML modules).

---

## 1. MongoDB Atlas Setup Steps

### Step 1: Create a MongoDB Atlas Account & Cluster
1. Sign up/Log in at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a new project named **SmartEats**.
3. Deploy a new database cluster (the **M0 Free Tier** is recommended for development).
4. Select your preferred Cloud Provider (e.g., AWS) and Region closest to you.

### Step 2: Configure Database Access (Security)
1. Navigate to **Security** > **Database Access** in the left sidebar.
2. Click **Add New Database User**.
3. Create a user (e.g., `smarteats_admin`) with **Read and write to any database** privileges. Choose a secure password or autogenerate one.

### Step 3: Configure Network Access (IP Whitelisting)
1. Navigate to **Security** > **Network Access**.
2. Click **Add IP Address**.
3. For development purposes, you can select **Allow Access From Anywhere** (`0.0.0.0/0`), or enter your current IP address for production-level security.

### Step 4: Retrieve the Connection String
1. Navigate to **Deployment** > **Database**.
2. Click **Connect** on your cluster.
3. Choose **Drivers** (select Java or Python depending on the module).
4. Copy the connection URI. It will look like this:
   ```connection-string
   mongodb+srv://<db_username>:<db_password>@<cluster-url>/?retryWrites=true&w=majority&appName=SmartEatsCluster
   ```

---

## 2. Backend Configuration (Spring Boot)

In the Spring Boot backend (`backend/src/main/resources/application.yml`), configure the connection using environment variables to keep credentials secure.

```yaml
spring:
  data:
    mongodb:
      uri: ${MONGODB_URI:mongodb://localhost:27017/smarteats}
```

### Running Locally with Environment Variables
Set the connection string in your local environment or terminal before running Spring Boot:

#### PowerShell (Windows)
```powershell
$env:MONGODB_URI="mongodb+srv://smarteats_admin:<password>@cluster0.xxxxxx.mongodb.net/smarteats?retryWrites=true&w=majority"
mvn spring-boot:run
```

#### Bash (Linux/macOS)
```bash
export MONGODB_URI="mongodb+srv://smarteats_admin:<password>@cluster0.xxxxxx.mongodb.net/smarteats?retryWrites=true&w=majority"
./mvnw spring-boot:run
```

---

## 3. Python ML / FastAPI Configuration

For the AI/ML forecasting module, you can use `pymongo` or `motor` (for async).

### Install Dependency
```bash
pip install pymongo dnspython
```

### Python Connection Snippet
```python
import os
from pymongo import MongoClient

# Fetch connection URI from environment variables
mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017/smarteats")
client = MongoClient(mongo_uri)

# Test Connection
try:
    client.admin.command('ping')
    print("Pinged your deployment. You successfully connected to MongoDB Atlas!")
    db = client["smarteats"]
except Exception as e:
    print(f"Error connecting to MongoDB: {e}")
```
