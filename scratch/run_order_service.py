import os
import subprocess
import sys
import time

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")
LOGS_DIR = os.path.join(PROJECT_ROOT, "logs")

env_file = os.path.join(PROJECT_ROOT, ".env")
if os.path.exists(env_file):
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()

JAVA_EXE = r"C:\Users\lenovo\.antigravity-ide\extensions\redhat.java-1.56.0-win32-x64\jre\21.0.12.1-win32-x86_64\bin\java.exe"

out_log = os.path.join(LOGS_DIR, "order-service.log")
err_log = os.path.join(LOGS_DIR, "order-service.err.log")

out_file = open(out_log, "a", encoding="utf-8")
err_file = open(err_log, "a", encoding="utf-8")

cmd = [
    JAVA_EXE, "-Xms64m", "-Xmx256m",
    "-Dspring.data.redis.host=localhost",
    "-Dspring.kafka.bootstrap-servers=localhost:9092",
    f"-Dspring.data.mongodb.uri={os.environ.get('MONGODB_URI_ORDER')}",
    f"-Drazorpay.key-id={os.environ.get('RAZORPAY_KEY_ID', 'rzp_test_SZ9vgZQjij4g7j')}",
    f"-Drazorpay.key-secret={os.environ.get('RAZORPAY_KEY_SECRET', 'eU3taZ4ADVpI3HT3sfnjRfvf')}",
    "-jar", "order-service/target/order-service-0.0.1-SNAPSHOT.jar"
]

print("Launching Order Service...")
p = subprocess.Popen(
    cmd,
    cwd=BACKEND_DIR,
    stdout=out_file,
    stderr=err_file,
    env=os.environ
)
print(f"Order Service started with PID {p.pid}")
