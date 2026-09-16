# Launch all SmartEats services via decoupled WMI process
$java = "C:\Users\lenovo\.antigravity-ide\extensions\redhat.java-1.56.0-win32-x64\jre\21.0.12.1-win32-x86_64\bin\java.exe"
$nodeDir = "E:\Users\Lenovo\node-v26.3.0-win-x64"
$python = "C:\Users\lenovo\AppData\Local\Programs\Python\Python314\python.exe"

$projectRoot = "d:\E\3rd Sem capston project\SmartEats"
$backend = "$projectRoot\backend"
$rdss = "$projectRoot\rdss-ai-service"
$frontend = "$projectRoot\frontend"

function Start-WmiProcess($name, $cmdLine, $workDir) {
    Write-Host "Starting $name..."
    $res = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
        CommandLine = $cmdLine
        CurrentDirectory = $workDir
    }
    Write-Host "  -> Spawned with PID: $($res.ProcessId)"
}

# 1. RDSS AI Service (:8000)
$rdssPort = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if (-not $rdssPort) {
    $cmd = "cmd.exe /c `"`"$python`" -u -m uvicorn main:app --host 0.0.0.0 --port 8000 > rdss.log 2>&1`""
    Start-WmiProcess "RDSS AI Service (:8000)" $cmd $rdss
} else {
    Write-Host "RDSS (:8000) is already running."
}

# 2. Auth Service (:8081)
$authPort = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue
if (-not $authPort) {
    $cmd = "cmd.exe /c `"`"$java`" -Xms64m -Xmx256m -Dspring.kafka.bootstrap-servers=localhost:9092 -jar auth-service/target/auth-service-0.0.1-SNAPSHOT.jar > auth-service.log 2>&1`""
    Start-WmiProcess "Auth Service (:8081)" $cmd $backend
} else {
    Write-Host "Auth Service (:8081) is already running."
}

# 3. Restaurant Service (:8082)
$restPort = Get-NetTCPConnection -LocalPort 8082 -ErrorAction SilentlyContinue
if (-not $restPort) {
    $cmd = "cmd.exe /c `"`"$java`" -Xms64m -Xmx256m -Dspring.data.redis.host=localhost -Dspring.kafka.bootstrap-servers=localhost:9092 -jar restaurant-service/target/restaurant-service-0.0.1-SNAPSHOT.jar > restaurant-service.log 2>&1`""
    Start-WmiProcess "Restaurant Service (:8082)" $cmd $backend
} else {
    Write-Host "Restaurant Service (:8082) is already running."
}

# 4. Order Service (:8083)
$orderPort = Get-NetTCPConnection -LocalPort 8083 -ErrorAction SilentlyContinue
if (-not $orderPort) {
    $cmd = "cmd.exe /c `"`"$java`" -Xms64m -Xmx256m -Dspring.data.redis.host=localhost -Dspring.kafka.bootstrap-servers=localhost:9092 -jar order-service/target/order-service-0.0.1-SNAPSHOT.jar > order-service.log 2>&1`""
    Start-WmiProcess "Order Service (:8083)" $cmd $backend
} else {
    Write-Host "Order Service (:8083) is already running."
}

# 5. Delivery Service (:8084)
$delPort = Get-NetTCPConnection -LocalPort 8084 -ErrorAction SilentlyContinue
if (-not $delPort) {
    $cmd = "cmd.exe /c `"`"$java`" -Xms64m -Xmx256m -Dspring.kafka.bootstrap-servers=localhost:9092 -jar delivery-service/target/delivery-service-0.0.1-SNAPSHOT.jar > delivery-service.log 2>&1`""
    Start-WmiProcess "Delivery Service (:8084)" $cmd $backend
} else {
    Write-Host "Delivery Service (:8084) is already running."
}

# 6. Notification Service (:8085)
$notifPort = Get-NetTCPConnection -LocalPort 8085 -ErrorAction SilentlyContinue
if (-not $notifPort) {
    $cmd = "cmd.exe /c `"`"$java`" -Xms64m -Xmx256m -Dspring.kafka.bootstrap-servers=localhost:9092 -jar notification-service/target/notification-service-0.0.1-SNAPSHOT.jar > notification-service.log 2>&1`""
    Start-WmiProcess "Notification Service (:8085)" $cmd $backend
} else {
    Write-Host "Notification Service (:8085) is already running."
}

# 7. API Gateway (:8080)
$gwPort = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue
if (-not $gwPort) {
    $cmd = "cmd.exe /c `"`"$java`" -Xms64m -Xmx256m -jar api-gateway/target/api-gateway-0.0.1-SNAPSHOT.jar > api-gateway.log 2>&1`""
    Start-WmiProcess "API Gateway (:8080)" $cmd $backend
} else {
    Write-Host "API Gateway (:8080) is already running."
}

# 8. Frontend (:3000)
$fePort = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if (-not $fePort) {
    $cmd = "cmd.exe /c `"set `"PATH=$nodeDir;%PATH%`" && `"$nodeDir\node.exe`" `"$frontend\node_modules\vite\bin\vite.js`" > frontend.log 2>&1`""
    Start-WmiProcess "Frontend (:3000)" $cmd $frontend
} else {
    Write-Host "Frontend (:3000) is already running."
}

Write-Host "`nAll processes triggered via WMI."
