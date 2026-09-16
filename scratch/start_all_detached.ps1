# Detached Background Process Launcher for SmartEats
$java = "C:\Users\lenovo\.antigravity-ide\extensions\redhat.java-1.56.0-win32-x64\jre\21.0.12.1-win32-x86_64\bin\java.exe"
$nodeDir = "E:\Users\Lenovo\node-v26.3.0-win-x64"
$python = "C:\Users\lenovo\AppData\Local\Programs\Python\Python314\python.exe"

$projectRoot = "d:\E\3rd Sem capston project\SmartEats"
$backend = "$projectRoot\backend"
$rdss = "$projectRoot\rdss-ai-service"
$frontend = "$projectRoot\frontend"
$logs = "$projectRoot\logs"

$uriAuth = "mongodb+srv://soumenmondal741150_db_user:5r47pqpO9Xb2ITI6@smarteatscluster.02gfkuh.mongodb.net/smarteats_auth?retryWrites=true&w=majority"
$uriRest = "mongodb+srv://soumenmondal741150_db_user:5r47pqpO9Xb2ITI6@smarteatscluster.02gfkuh.mongodb.net/smarteats_restaurant?retryWrites=true&w=majority"
$uriOrder = "mongodb+srv://soumenmondal741150_db_user:5r47pqpO9Xb2ITI6@smarteatscluster.02gfkuh.mongodb.net/smarteats_order?retryWrites=true&w=majority"
$uriDel = "mongodb+srv://soumenmondal741150_db_user:5r47pqpO9Xb2ITI6@smarteatscluster.02gfkuh.mongodb.net/smarteats_delivery?retryWrites=true&w=majority"
$uriNotif = "mongodb+srv://soumenmondal741150_db_user:5r47pqpO9Xb2ITI6@smarteatscluster.02gfkuh.mongodb.net/smarteats_notification?retryWrites=true&w=majority"

# 1. RDSS AI Service (:8000)
$p8000 = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if (-not $p8000) {
    Write-Host "Starting RDSS AI (:8000)..."
    Start-Process -FilePath $python -ArgumentList "-u", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000" -WorkingDirectory $rdss -WindowStyle Hidden -RedirectStandardOutput "$logs\rdss.log" -RedirectStandardError "$logs\rdss.err.log"
} else { Write-Host "RDSS (:8000) already running." }

# 2. Auth Service (:8081)
$p8081 = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue
if (-not $p8081) {
    Write-Host "Starting Auth Service (:8081)..."
    Start-Process -FilePath $java -ArgumentList "-Xms64m", "-Xmx256m", "-Dspring.kafka.bootstrap-servers=localhost:9092", "-Dspring.data.mongodb.uri=$uriAuth", "-jar", "auth-service/target/auth-service-0.0.1-SNAPSHOT.jar" -WorkingDirectory $backend -WindowStyle Hidden -RedirectStandardOutput "$logs\auth-service.log" -RedirectStandardError "$logs\auth-service.err.log"
} else { Write-Host "Auth (:8081) already running." }

# 3. Restaurant Service (:8082)
$p8082 = Get-NetTCPConnection -LocalPort 8082 -ErrorAction SilentlyContinue
if (-not $p8082) {
    Write-Host "Starting Restaurant Service (:8082)..."
    Start-Process -FilePath $java -ArgumentList "-Xms64m", "-Xmx256m", "-Dspring.data.redis.host=localhost", "-Dspring.kafka.bootstrap-servers=localhost:9092", "-Dspring.data.mongodb.uri=$uriRest", "-jar", "restaurant-service/target/restaurant-service-0.0.1-SNAPSHOT.jar" -WorkingDirectory $backend -WindowStyle Hidden -RedirectStandardOutput "$logs\restaurant-service.log" -RedirectStandardError "$logs\restaurant-service.err.log"
} else { Write-Host "Restaurant (:8082) already running." }

# 4. Order Service (:8083)
$p8083 = Get-NetTCPConnection -LocalPort 8083 -ErrorAction SilentlyContinue
if (-not $p8083) {
    Write-Host "Starting Order Service (:8083)..."
    Start-Process -FilePath $java -ArgumentList "-Xms64m", "-Xmx256m", "-Dspring.data.redis.host=localhost", "-Dspring.kafka.bootstrap-servers=localhost:9092", "-Dspring.data.mongodb.uri=$uriOrder", "-jar", "order-service/target/order-service-0.0.1-SNAPSHOT.jar" -WorkingDirectory $backend -WindowStyle Hidden -RedirectStandardOutput "$logs\order-service.log" -RedirectStandardError "$logs\order-service.err.log"
} else { Write-Host "Order (:8083) already running." }

# 5. Delivery Service (:8084)
$p8084 = Get-NetTCPConnection -LocalPort 8084 -ErrorAction SilentlyContinue
if (-not $p8084) {
    Write-Host "Starting Delivery Service (:8084)..."
    Start-Process -FilePath $java -ArgumentList "-Xms64m", "-Xmx256m", "-Dspring.kafka.bootstrap-servers=localhost:9092", "-Dspring.data.mongodb.uri=$uriDel", "-jar", "delivery-service/target/delivery-service-0.0.1-SNAPSHOT.jar" -WorkingDirectory $backend -WindowStyle Hidden -RedirectStandardOutput "$logs\delivery-service.log" -RedirectStandardError "$logs\delivery-service.err.log"
} else { Write-Host "Delivery (:8084) already running." }

# 6. Notification Service (:8085)
$p8085 = Get-NetTCPConnection -LocalPort 8085 -ErrorAction SilentlyContinue
if (-not $p8085) {
    Write-Host "Starting Notification Service (:8085)..."
    Start-Process -FilePath $java -ArgumentList "-Xms64m", "-Xmx256m", "-Dspring.kafka.bootstrap-servers=localhost:9092", "-Dspring.data.mongodb.uri=$uriNotif", "-jar", "notification-service/target/notification-service-0.0.1-SNAPSHOT.jar" -WorkingDirectory $backend -WindowStyle Hidden -RedirectStandardOutput "$logs\notification-service.log" -RedirectStandardError "$logs\notification-service.err.log"
} else { Write-Host "Notification (:8085) already running." }

# 7. API Gateway (:8080)
$p8080 = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue
if (-not $p8080) {
    Write-Host "Starting API Gateway (:8080)..."
    Start-Process -FilePath $java -ArgumentList "-Xms64m", "-Xmx256m", "-jar", "api-gateway/target/api-gateway-0.0.1-SNAPSHOT.jar" -WorkingDirectory $backend -WindowStyle Hidden -RedirectStandardOutput "$logs\api-gateway.log" -RedirectStandardError "$logs\api-gateway.err.log"
} else { Write-Host "API Gateway (:8080) already running." }

# 8. Frontend (:3000)
$p3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if (-not $p3000) {
    Write-Host "Starting Frontend (:3000)..."
    $nodeExe = "$nodeDir\node.exe"
    $viteJs = "$frontend\node_modules\vite\bin\vite.js"
    Start-Process -FilePath $nodeExe -ArgumentList "`"$viteJs`"" -WorkingDirectory $frontend -WindowStyle Hidden -RedirectStandardOutput "$logs\frontend.log" -RedirectStandardError "$logs\frontend.err.log"
} else { Write-Host "Frontend (:3000) already running." }

Write-Host "`nAll services have been launched detached."
