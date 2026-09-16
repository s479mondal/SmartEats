# Startup script for SmartEats complete testing audit
$javaExe = "C:\Users\lenovo\.antigravity-ide\extensions\redhat.java-1.56.0-win32-x64\jre\21.0.12.1-win32-x86_64\bin\java.exe"
$nodeDir = "E:\Users\Lenovo\node-v26.3.0-win-x64"

$env:PATH = "$nodeDir;C:\Users\lenovo\.antigravity-ide\extensions\redhat.java-1.56.0-win32-x64\jre\21.0.12.1-win32-x86_64\bin;" + $env:PATH
[System.Environment]::SetEnvironmentVariable("PATH", $env:PATH, "Process")

$projectRoot = "d:\E\3rd Sem capston project\SmartEats"
$backendDir = "$projectRoot\backend"
$rdssDir = "$projectRoot\rdss-ai-service"
$frontendDir = "$projectRoot\frontend"

# Load .env
$envFile = "$projectRoot\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | Where-Object { $_ -match '^[^#].*=' } | ForEach-Object {
        $key, $value = $_.Split('=', 2)
        [System.Environment]::SetEnvironmentVariable($key.Trim(), $value.Trim(), "Process")
    }
}

Write-Host "Starting RDSS AI Service (:8000)..."
$pythonExe = "$rdssDir\.venv\Scripts\python.exe"
Start-Process -NoNewWindow -FilePath $pythonExe -ArgumentList "-u", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000" -WorkingDirectory $rdssDir -RedirectStandardOutput "$rdssDir\rdss.log" -RedirectStandardError "$rdssDir\rdss.err.log"

Write-Host "Starting Auth Service (:8081)..."
Start-Process -NoNewWindow -FilePath $javaExe -ArgumentList "-Dspring.kafka.bootstrap-servers=localhost:9092", "-jar", "auth-service/target/auth-service-0.0.1-SNAPSHOT.jar" -WorkingDirectory $backendDir -RedirectStandardOutput "$backendDir\auth-service.log" -RedirectStandardError "$backendDir\auth-service.err.log"

Write-Host "Starting Restaurant Service (:8082)..."
Start-Process -NoNewWindow -FilePath $javaExe -ArgumentList "-Dspring.data.redis.host=localhost", "-Dspring.kafka.bootstrap-servers=localhost:9092", "-jar", "restaurant-service/target/restaurant-service-0.0.1-SNAPSHOT.jar" -WorkingDirectory $backendDir -RedirectStandardOutput "$backendDir\restaurant-service.log" -RedirectStandardError "$backendDir\restaurant-service.err.log"

Write-Host "Starting Order Service (:8083)..."
Start-Process -NoNewWindow -FilePath $javaExe -ArgumentList "-Dspring.data.redis.host=localhost", "-Dspring.kafka.bootstrap-servers=localhost:9092", "-jar", "order-service/target/order-service-0.0.1-SNAPSHOT.jar" -WorkingDirectory $backendDir -RedirectStandardOutput "$backendDir\order-service.log" -RedirectStandardError "$backendDir\order-service.err.log"

Write-Host "Starting Delivery Service (:8084)..."
Start-Process -NoNewWindow -FilePath $javaExe -ArgumentList "-Dspring.kafka.bootstrap-servers=localhost:9092", "-jar", "delivery-service/target/delivery-service-0.0.1-SNAPSHOT.jar" -WorkingDirectory $backendDir -RedirectStandardOutput "$backendDir\delivery-service.log" -RedirectStandardError "$backendDir\delivery-service.err.log"

Write-Host "Starting Notification Service (:8085)..."
Start-Process -NoNewWindow -FilePath $javaExe -ArgumentList "-Dspring.kafka.bootstrap-servers=localhost:9092", "-jar", "notification-service/target/notification-service-0.0.1-SNAPSHOT.jar" -WorkingDirectory $backendDir -RedirectStandardOutput "$backendDir\notification-service.log" -RedirectStandardError "$backendDir\notification-service.err.log"

Write-Host "Starting API Gateway (:8080)..."
Start-Process -NoNewWindow -FilePath $javaExe -ArgumentList "-jar", "api-gateway/target/api-gateway-0.0.1-SNAPSHOT.jar" -WorkingDirectory $backendDir -RedirectStandardOutput "$backendDir\api-gateway.log" -RedirectStandardError "$backendDir\api-gateway.err.log"

Write-Host "Starting Frontend (:3000)..."
Start-Process -NoNewWindow -FilePath "cmd.exe" -ArgumentList "/c", "`"$nodeDir\npm.cmd`" run dev" -WorkingDirectory $frontendDir -RedirectStandardOutput "$frontendDir\frontend.log" -RedirectStandardError "$frontendDir\frontend.err.log"

Write-Host "All components triggered successfully."
