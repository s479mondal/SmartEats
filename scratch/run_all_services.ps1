# SmartEats Comprehensive Services Bootstrapper
$javaExe = "C:\Users\lenovo\.antigravity-ide\extensions\redhat.java-1.56.0-win32-x64\jre\21.0.12.1-win32-x86_64\bin\java.exe"
$nodeDir = "E:\Users\Lenovo\node-v26.3.0-win-x64"

$env:PATH = "$nodeDir;C:\Users\lenovo\.antigravity-ide\extensions\redhat.java-1.56.0-win32-x64\jre\21.0.12.1-win32-x86_64\bin;" + $env:PATH
[System.Environment]::SetEnvironmentVariable("PATH", $env:PATH, "Process")

$projectRoot = "d:\E\3rd Sem capston project\SmartEats"
$backendDir = "$projectRoot\backend"
$rdssDir = "$projectRoot\rdss-ai-service"
$frontendDir = "$projectRoot\frontend"

# Load .env into process environment variables
$envFile = "$projectRoot\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | Where-Object { $_ -match '^[^#].*=' } | ForEach-Object {
        $key, $value = $_.Split('=', 2)
        Set-Item -Path "env:$($key.Trim())" -Value $value.Trim()
        [System.Environment]::SetEnvironmentVariable($key.Trim(), $value.Trim(), "Process")
    }
}

$env:KAFKA_SERVERS = "localhost:9092"
$env:REDIS_HOST = "localhost"

# 1. RDSS AI Service (:8000)
$rdssPort = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if (-not $rdssPort) {
    Write-Host "Starting RDSS AI Service (:8000)..."
    $pythonExe = "$rdssDir\.venv\Scripts\python.exe"
    Start-Process -NoNewWindow -FilePath $pythonExe -ArgumentList "-u", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000" -WorkingDirectory $rdssDir -RedirectStandardOutput "$rdssDir\rdss.log" -RedirectStandardError "$rdssDir\rdss.err.log"
} else {
    Write-Host "RDSS AI Service already running on port 8000."
}

# 2. Auth Service (:8081)
$authPort = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue
if (-not $authPort) {
    Write-Host "Starting Auth Service (:8081)..."
    Start-Process -NoNewWindow -FilePath $javaExe -ArgumentList "-Dspring.kafka.bootstrap-servers=localhost:9092", "-jar", "auth-service/target/auth-service-0.0.1-SNAPSHOT.jar" -WorkingDirectory $backendDir -RedirectStandardOutput "$backendDir\auth-service.log" -RedirectStandardError "$backendDir\auth-service.err.log"
} else {
    Write-Host "Auth Service already running on port 8081."
}

# 3. Restaurant Service (:8082)
$restPort = Get-NetTCPConnection -LocalPort 8082 -ErrorAction SilentlyContinue
if (-not $restPort) {
    Write-Host "Starting Restaurant Service (:8082)..."
    Start-Process -NoNewWindow -FilePath $javaExe -ArgumentList "-Dspring.data.redis.host=localhost", "-Dspring.kafka.bootstrap-servers=localhost:9092", "-jar", "restaurant-service/target/restaurant-service-0.0.1-SNAPSHOT.jar" -WorkingDirectory $backendDir -RedirectStandardOutput "$backendDir\restaurant-service.log" -RedirectStandardError "$backendDir\restaurant-service.err.log"
} else {
    Write-Host "Restaurant Service already running on port 8082."
}

# 4. Order Service (:8083)
$orderPort = Get-NetTCPConnection -LocalPort 8083 -ErrorAction SilentlyContinue
if (-not $orderPort) {
    Write-Host "Starting Order Service (:8083)..."
    Start-Process -NoNewWindow -FilePath $javaExe -ArgumentList "-Dspring.data.redis.host=localhost", "-Dspring.kafka.bootstrap-servers=localhost:9092", "-jar", "order-service/target/order-service-0.0.1-SNAPSHOT.jar" -WorkingDirectory $backendDir -RedirectStandardOutput "$backendDir\order-service.log" -RedirectStandardError "$backendDir\order-service.err.log"
} else {
    Write-Host "Order Service already running on port 8083."
}

# 5. Delivery Service (:8084)
$delPort = Get-NetTCPConnection -LocalPort 8084 -ErrorAction SilentlyContinue
if (-not $delPort) {
    Write-Host "Starting Delivery Service (:8084)..."
    Start-Process -NoNewWindow -FilePath $javaExe -ArgumentList "-Dspring.kafka.bootstrap-servers=localhost:9092", "-jar", "delivery-service/target/delivery-service-0.0.1-SNAPSHOT.jar" -WorkingDirectory $backendDir -RedirectStandardOutput "$backendDir\delivery-service.log" -RedirectStandardError "$backendDir\delivery-service.err.log"
} else {
    Write-Host "Delivery Service already running on port 8084."
}

# 6. Notification Service (:8085)
$notifPort = Get-NetTCPConnection -LocalPort 8085 -ErrorAction SilentlyContinue
if (-not $notifPort) {
    Write-Host "Starting Notification Service (:8085)..."
    Start-Process -NoNewWindow -FilePath $javaExe -ArgumentList "-Dspring.kafka.bootstrap-servers=localhost:9092", "-jar", "notification-service/target/notification-service-0.0.1-SNAPSHOT.jar" -WorkingDirectory $backendDir -RedirectStandardOutput "$backendDir\notification-service.log" -RedirectStandardError "$backendDir\notification-service.err.log"
} else {
    Write-Host "Notification Service already running on port 8085."
}

# 7. API Gateway (:8080)
$gwPort = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue
if (-not $gwPort) {
    Write-Host "Starting API Gateway (:8080)..."
    Start-Process -NoNewWindow -FilePath $javaExe -ArgumentList "-jar", "api-gateway/target/api-gateway-0.0.1-SNAPSHOT.jar" -WorkingDirectory $backendDir -RedirectStandardOutput "$backendDir\api-gateway.log" -RedirectStandardError "$backendDir\api-gateway.err.log"
} else {
    Write-Host "API Gateway already running on port 8080."
}

# 8. Frontend (:3000)
$fePort = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if (-not $fePort) {
    Write-Host "Starting Frontend (:3000)..."
    Start-Process -NoNewWindow -FilePath "$nodeDir\npm.cmd" -ArgumentList "run", "dev" -WorkingDirectory $frontendDir -RedirectStandardOutput "$frontendDir\frontend.log" -RedirectStandardError "$frontendDir\frontend.err.log"
} else {
    Write-Host "Frontend already running on port 3000."
}

Write-Host "All background processes spawned."
