import os
import sys
import subprocess
import re

ports_to_kill = [3000, 8080, 8081, 8082, 8083, 8084, 8085, 8000]

print("==================================================")
print("       SMARTEATS SYSTEM SHUTDOWN ORCHESTRATOR     ")
print("==================================================")

killed_pids = set()

for port in ports_to_kill:
    try:
        out = subprocess.check_output(f'netstat -ano | findstr :{port}', shell=True, text=True, stderr=subprocess.DEVNULL)
        for line in out.strip().splitlines():
            parts = line.strip().split()
            if len(parts) >= 5 and "LISTENING" in line:
                pid = parts[-1]
                if pid not in killed_pids and pid != "0":
                    killed_pids.add(pid)
                    print(f"Stopping service on Port {port} (PID {pid})...")
                    subprocess.run(f"taskkill /F /PID {pid} /T", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass

print(f"Stopped {len(killed_pids)} running service process(es).")

# Ask to stop Docker infra
docker_cmd = r"C:\Users\lenovo\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe"
if os.path.exists(docker_cmd):
    print("Stopping Docker containers (Redis, Kafka, Zookeeper)...")
    subprocess.run([docker_cmd, "compose", "stop", "redis", "zookeeper", "kafka"], cwd=os.path.dirname(__file__), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

print("All SmartEats services have been safely stopped.")
