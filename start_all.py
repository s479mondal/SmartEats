import os
import sys
import time
import socket
import subprocess
import urllib.request

PROJECT_ROOT = os.path.abspath(os.path.dirname(__file__))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")
RDSS_DIR = os.path.join(PROJECT_ROOT, "rdss-ai-service")
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")
LOGS_DIR = os.path.join(PROJECT_ROOT, "logs")

os.makedirs(LOGS_DIR, exist_ok=True)

# 1. Load .env
env_file = os.path.join(PROJECT_ROOT, ".env")
if os.path.exists(env_file):
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()

os.environ["KAFKA_SERVERS"] = "localhost:9092"
os.environ["REDIS_HOST"] = "localhost"

JAVA_EXE = r"C:\Users\lenovo\.antigravity-ide\extensions\redhat.java-1.56.0-win32-x64\jre\21.0.12.1-win32-x86_64\bin\java.exe"
NODE_DIR = r"E:\Users\Lenovo\node-v26.3.0-win-x64"
NPM_CMD = os.path.join(NODE_DIR, "npm.cmd")
RDSS_PYTHON = os.path.join(RDSS_DIR, ".venv", "Scripts", "python.exe")

os.environ["PATH"] = f"{NODE_DIR};{os.path.dirname(JAVA_EXE)};" + os.environ.get("PATH", "")

def is_port_open(port):
    try:
        s = socket.create_connection(('localhost', port), timeout=0.5)
        s.close()
        return True
    except OSError:
        return False

def check_docker_infra():
    print("Checking Docker infrastructure (Kafka, Redis, Zookeeper)...")
    for name, port in [("Redis", 6379), ("Kafka", 9092), ("Zookeeper", 2181)]:
        if is_port_open(port):
            print(f"  [OK] {name} is listening on port {port}")
        else:
            print(f"  [STARTING] {name} on port {port} is not running. Starting Docker containers...")
            docker_cmd = r"C:\Users\lenovo\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe"
            subprocess.run([docker_cmd, "compose", "up", "-d", "redis", "zookeeper", "kafka"], cwd=PROJECT_ROOT)
            time.sleep(5)
            break

def launch_service(name, cmd, cwd, log_prefix):
    out_log = os.path.join(LOGS_DIR, f"{log_prefix}.log")
    err_log = os.path.join(LOGS_DIR, f"{log_prefix}.err.log")
    
    out_file = open(out_log, "w", encoding="utf-8")
    err_file = open(err_log, "w", encoding="utf-8")
    
    print(f"Launching {name}...")
    p = subprocess.Popen(
        cmd,
        cwd=cwd,
        stdout=out_file,
        stderr=err_file,
        env=os.environ,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
    )
    return p

def main():
    print("==================================================")
    print("      SMARTEATS SYSTEM STARTUP ORCHESTRATOR      ")
    print("==================================================\n")
    
    check_docker_infra()
    
    services = [
        {
            "name": "RDSS AI Service (:8000)",
            "port": 8000,
            "cmd": [RDSS_PYTHON, "-u", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"],
            "cwd": RDSS_DIR,
            "log": "rdss"
        },
        {
            "name": "Auth Service (:8081)",
            "port": 8081,
            "cmd": [
                JAVA_EXE, "-Xms64m", "-Xmx256m",
                "-Dspring.kafka.bootstrap-servers=localhost:9092",
                f"-Dspring.data.mongodb.uri={os.environ.get('MONGODB_URI_AUTH')}",
                "-jar", "auth-service/target/auth-service-0.0.1-SNAPSHOT.jar"
            ],
            "cwd": BACKEND_DIR,
            "log": "auth-service"
        },
        {
            "name": "Restaurant Service (:8082)",
            "port": 8082,
            "cmd": [
                JAVA_EXE, "-Xms64m", "-Xmx256m",
                "-Dspring.data.redis.host=localhost",
                "-Dspring.kafka.bootstrap-servers=localhost:9092",
                f"-Dspring.data.mongodb.uri={os.environ.get('MONGODB_URI_RESTAURANT')}",
                "-jar", "restaurant-service/target/restaurant-service-0.0.1-SNAPSHOT.jar"
            ],
            "cwd": BACKEND_DIR,
            "log": "restaurant-service"
        },
        {
            "name": "Order Service (:8083)",
            "port": 8083,
            "cmd": [
                JAVA_EXE, "-Xms64m", "-Xmx256m",
                "-Dspring.data.redis.host=localhost",
                "-Dspring.kafka.bootstrap-servers=localhost:9092",
                f"-Dspring.data.mongodb.uri={os.environ.get('MONGODB_URI_ORDER')}",
                f"-Drazorpay.key-id={os.environ.get('RAZORPAY_KEY_ID', 'rzp_test_SZ9vgZQjij4g7j')}",
                f"-Drazorpay.key-secret={os.environ.get('RAZORPAY_KEY_SECRET', 'eU3taZ4ADVpI3HT3sfnjRfvf')}",
                "-jar", "order-service/target/order-service-0.0.1-SNAPSHOT.jar"
            ],
            "cwd": BACKEND_DIR,
            "log": "order-service"
        },
        {
            "name": "Delivery Service (:8084)",
            "port": 8084,
            "cmd": [
                JAVA_EXE, "-Xms64m", "-Xmx256m",
                "-Dspring.kafka.bootstrap-servers=localhost:9092",
                f"-Dspring.data.mongodb.uri={os.environ.get('MONGODB_URI_DELIVERY')}",
                "-jar", "delivery-service/target/delivery-service-0.0.1-SNAPSHOT.jar"
            ],
            "cwd": BACKEND_DIR,
            "log": "delivery-service"
        },
        {
            "name": "Notification Service (:8085)",
            "port": 8085,
            "cmd": [
                JAVA_EXE, "-Xms64m", "-Xmx256m",
                "-Dspring.kafka.bootstrap-servers=localhost:9092",
                f"-Dspring.data.mongodb.uri={os.environ.get('MONGODB_URI_NOTIFICATION')}",
                "-jar", "notification-service/target/notification-service-0.0.1-SNAPSHOT.jar"
            ],
            "cwd": BACKEND_DIR,
            "log": "notification-service"
        },
        {
            "name": "API Gateway (:8080)",
            "port": 8080,
            "cmd": [
                JAVA_EXE, "-Xms64m", "-Xmx256m",
                "-jar", "api-gateway/target/api-gateway-0.0.1-SNAPSHOT.jar"
            ],
            "cwd": BACKEND_DIR,
            "log": "api-gateway"
        },
        {
            "name": "React Frontend (:3000)",
            "port": 3000,
            "cmd": ["cmd.exe", "/c", NPM_CMD, "run", "dev"],
            "cwd": FRONTEND_DIR,
            "log": "frontend"
        }
    ]
    
    # Check already running vs needs starting
    launched_procs = []
    for svc in services:
        if is_port_open(svc["port"]):
            print(f"  [ALREADY RUNNING] {svc['name']}", flush=True)
        else:
            p = launch_service(svc["name"], svc["cmd"], svc["cwd"], svc["log"])
            launched_procs.append((svc["name"], p))
            
    print("\nWaiting for all services to initialize and bind ports...", flush=True)
    
    # Wait loop
    start_time = time.time()
    max_wait = 60 # seconds
    pending = list(services)
    
    while pending and (time.time() - start_time) < max_wait:
        still_pending = []
        for svc in pending:
            if is_port_open(svc["port"]):
                print(f"  [ONLINE] {svc['name']} is ready!", flush=True)
            else:
                still_pending.append(svc)
        pending = still_pending
        if pending:
            time.sleep(2)
            
    print("\n--------------------------------------------------", flush=True)
    print("             FINAL SYSTEM STATUS REPORT           ", flush=True)
    print("--------------------------------------------------", flush=True)
    all_ok = True
    for svc in services:
        status = "HEALTHY & RUNNING" if is_port_open(svc["port"]) else "FAILED / PENDING"
        if "FAILED" in status:
            all_ok = False
        print(f"  * {svc['name']:<30}: {status}", flush=True)
        
    for name, port in [("Redis Cache", 6379), ("Kafka Broker", 9092), ("Zookeeper", 2181)]:
        stat = "HEALTHY & RUNNING" if is_port_open(port) else "OFFLINE"
        print(f"  * {name + f' (:{port})':<30}: {stat}", flush=True)
        
    print("--------------------------------------------------", flush=True)
    if all_ok:
        print("\nAll 8 application components + 3 infrastructure services are LIVE!", flush=True)
        print("Frontend UI is available at: http://localhost:3000", flush=True)
        print("API Gateway is available at:  http://localhost:8080", flush=True)
        print("RDSS AI Swagger API at:      http://localhost:8000/docs", flush=True)
    else:
        print("\nSome services took longer than expected to bind ports. Check logs/ directory.", flush=True)

    print("\nSmartEats is actively running. Press Ctrl+C to stop all services.", flush=True)
    try:
        while True:
            time.sleep(5)
    except (KeyboardInterrupt, SystemExit):
        print("\nShutting down SmartEats...", flush=True)
        for name, p in launched_procs:
            try:
                p.terminate()
            except Exception:
                pass

if __name__ == "__main__":
    main()

