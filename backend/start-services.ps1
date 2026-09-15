# Load .env if present
$envFile = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | Where-Object { $_ -match '^[^#].*=' } | ForEach-Object {
        $key, $value = $_.Split('=', 2)
        [System.Environment]::SetEnvironmentVariable($key.Trim(), $value.Trim(), "Process")
    }
}

Write-Host "Starting Auth Service..."
Start-Process -NoNewWindow -FilePath java -ArgumentList "-Dspring.kafka.bootstrap-servers=localhost:9092", "-jar", "auth-service/target/auth-service-0.0.1-SNAPSHOT.jar" -RedirectStandardOutput auth-service.log -RedirectStandardError auth-service.err.log

Write-Host "Starting Restaurant Service..."
Start-Process -NoNewWindow -FilePath java -ArgumentList "-Dspring.data.redis.host=localhost", "-Dspring.kafka.bootstrap-servers=localhost:9092", "-jar", "restaurant-service/target/restaurant-service-0.0.1-SNAPSHOT.jar" -RedirectStandardOutput restaurant-service.log -RedirectStandardError restaurant-service.err.log

Write-Host "Starting Order Service..."
Start-Process -NoNewWindow -FilePath java -ArgumentList "-Dspring.data.redis.host=localhost", "-Dspring.kafka.bootstrap-servers=localhost:9092", "-jar", "order-service/target/order-service-0.0.1-SNAPSHOT.jar" -RedirectStandardOutput order-service.log -RedirectStandardError order-service.err.log

Write-Host "Starting Delivery Service..."
Start-Process -NoNewWindow -FilePath java -ArgumentList "-Dspring.kafka.bootstrap-servers=localhost:9092", "-jar", "delivery-service/target/delivery-service-0.0.1-SNAPSHOT.jar" -RedirectStandardOutput delivery-service.log -RedirectStandardError delivery-service.err.log

Write-Host "Starting Notification Service..."
Start-Process -NoNewWindow -FilePath java -ArgumentList "-Dspring.kafka.bootstrap-servers=localhost:9092", "-jar", "notification-service/target/notification-service-0.0.1-SNAPSHOT.jar" -RedirectStandardOutput notification-service.log -RedirectStandardError notification-service.err.log

Write-Host "Starting API Gateway..."
Start-Process -NoNewWindow -FilePath java -ArgumentList "-jar", "api-gateway/target/api-gateway-0.0.1-SNAPSHOT.jar" -RedirectStandardOutput api-gateway.log -RedirectStandardError api-gateway.err.log

Write-Host "All backend services started."
