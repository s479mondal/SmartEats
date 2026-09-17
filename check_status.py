import socket
import urllib.request
import json

ports = [
    ("React Frontend", 3000),
    ("Spring Cloud API Gateway", 8080),
    ("Auth Microservice", 8081),
    ("Restaurant Microservice", 8082),
    ("Order Microservice", 8083),
    ("Delivery Microservice", 8084),
    ("Notification Microservice", 8085),
    ("RDSS AI Service (FastAPI)", 8000),
    ("Redis In-Memory Store", 6379),
    ("Apache Kafka Broker", 9092),
    ("Apache Zookeeper", 2181)
]

print("=" * 60)
print("       SMARTEATS SYSTEM COMPREHENSIVE HEALTH AUDIT")
print("=" * 60)

all_ok = True
for name, port in ports:
    try:
        s = socket.create_connection(("localhost", port), timeout=1.0)
        s.close()
        is_up = True
    except OSError:
        is_up = False
    if not is_up:
        all_ok = False
    status_str = "[ONLINE / LISTENING]" if is_up else "[OFFLINE]"
    print(f"  * {name:<30} (Port {port:4d}) : {status_str}")

print("-" * 60)

# Quick HTTP tests
http_tests = [
    ("Frontend Home Page", "http://localhost:3000"),
    ("RDSS AI Root", "http://localhost:8000/"),
    ("RDSS Swagger Docs", "http://localhost:8000/docs"),
    ("API Gateway Ingress", "http://localhost:8080/api/restaurants")
]

print("HTTP Endpoint Live Verification:")
for label, url in http_tests:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "SmartEats-HealthCheck"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            print(f"  * {label:<25} ({url}) -> HTTP {resp.status} OK")
    except urllib.error.HTTPError as e:
        print(f"  * {label:<25} ({url}) -> HTTP {e.code} (Reachable)")
    except Exception as e:
        print(f"  * {label:<25} ({url}) -> Error: {e}")

print("=" * 60)
if all_ok:
    print("STATUS: ALL 11 SERVICES AND PORTS ARE 100% OPERATIONAL AND READY!")
else:
    print("STATUS: ONE OR MORE SERVICES ARE NOT LISTENING.")
print("=" * 60)
