@echo off
setlocal enabledelayedexpansion

set "JAVA_EXE=C:\Users\lenovo\.antigravity-ide\extensions\redhat.java-1.56.0-win32-x64\jre\21.0.12.1-win32-x86_64\bin\java.exe"
set "NODE_DIR=E:\Users\Lenovo\node-v26.3.0-win-x64"
set "PATH=%NODE_DIR%;C:\Users\lenovo\.antigravity-ide\extensions\redhat.java-1.56.0-win32-x64\jre\21.0.12.1-win32-x86_64\bin;%PATH%"

set "MONGODB_USER=soumenmondal741150_db_user"
set "MONGODB_PASSWORD=5r47pqpO9Xb2ITI6"
set "MONGODB_URI=mongodb+srv://soumenmondal741150_db_user:5r47pqpO9Xb2ITI6@smarteatscluster.02gfkuh.mongodb.net/smarteats?retryWrites=true&w=majority"
set "MONGODB_URI_AUTH=mongodb+srv://soumenmondal741150_db_user:5r47pqpO9Xb2ITI6@smarteatscluster.02gfkuh.mongodb.net/smarteats_auth?retryWrites=true&w=majority"
set "MONGODB_URI_RESTAURANT=mongodb+srv://soumenmondal741150_db_user:5r47pqpO9Xb2ITI6@smarteatscluster.02gfkuh.mongodb.net/smarteats_restaurant?retryWrites=true&w=majority"
set "MONGODB_URI_ORDER=mongodb+srv://soumenmondal741150_db_user:5r47pqpO9Xb2ITI6@smarteatscluster.02gfkuh.mongodb.net/smarteats_order?retryWrites=true&w=majority"
set "MONGODB_URI_DELIVERY=mongodb+srv://soumenmondal741150_db_user:5r47pqpO9Xb2ITI6@smarteatscluster.02gfkuh.mongodb.net/smarteats_delivery?retryWrites=true&w=majority"
set "MONGODB_URI_NOTIFICATION=mongodb+srv://soumenmondal741150_db_user:5r47pqpO9Xb2ITI6@smarteatscluster.02gfkuh.mongodb.net/smarteats_notification?retryWrites=true&w=majority"
set "KAFKA_SERVERS=localhost:9092"
set "REDIS_HOST=localhost"

set "PYTHON_EXE=C:\Users\lenovo\AppData\Local\Programs\Python\Python314\python.exe"

cd /d "d:\E\3rd Sem capston project\SmartEats"

echo [1/8] Starting RDSS AI Service (:8000)...
start /b "" cmd /c "cd /d rdss-ai-service && "%PYTHON_EXE%" -u -m uvicorn main:app --host 0.0.0.0 --port 8000 > rdss.log 2>&1"

echo [2/8] Starting Auth Service (:8081)...
start /b "" cmd /c "cd /d backend && "%JAVA_EXE%" -Xms64m -Xmx256m -Dspring.kafka.bootstrap-servers=localhost:9092 -jar auth-service\target\auth-service-0.0.1-SNAPSHOT.jar > auth-service.log 2>&1"

echo [3/8] Starting Restaurant Service (:8082)...
start /b "" cmd /c "cd /d backend && "%JAVA_EXE%" -Xms64m -Xmx256m -Dspring.data.redis.host=localhost -Dspring.kafka.bootstrap-servers=localhost:9092 -jar restaurant-service\target\restaurant-service-0.0.1-SNAPSHOT.jar > restaurant-service.log 2>&1"

echo [4/8] Starting Order Service (:8083)...
start /b "" cmd /c "cd /d backend && "%JAVA_EXE%" -Xms64m -Xmx256m -Dspring.data.redis.host=localhost -Dspring.kafka.bootstrap-servers=localhost:9092 -jar order-service\target\order-service-0.0.1-SNAPSHOT.jar > order-service.log 2>&1"

echo [5/8] Starting Delivery Service (:8084)...
start /b "" cmd /c "cd /d backend && "%JAVA_EXE%" -Xms64m -Xmx256m -Dspring.kafka.bootstrap-servers=localhost:9092 -jar delivery-service\target\delivery-service-0.0.1-SNAPSHOT.jar > delivery-service.log 2>&1"

echo [6/8] Starting Notification Service (:8085)...
start /b "" cmd /c "cd /d backend && "%JAVA_EXE%" -Xms64m -Xmx256m -Dspring.kafka.bootstrap-servers=localhost:9092 -jar notification-service\target\notification-service-0.0.1-SNAPSHOT.jar > notification-service.log 2>&1"

echo [7/8] Starting API Gateway (:8080)...
start /b "" cmd /c "cd /d backend && "%JAVA_EXE%" -Xms64m -Xmx256m -jar api-gateway\target\api-gateway-0.0.1-SNAPSHOT.jar > api-gateway.log 2>&1"

echo [8/8] Starting Frontend (:3000)...
start /b "" cmd /c "cd /d frontend && "%NODE_DIR%\node.exe" node_modules\vite\bin\vite.js > frontend.log 2>&1"

echo All services launched in background.
