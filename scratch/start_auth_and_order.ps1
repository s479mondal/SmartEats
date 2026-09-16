$java = "C:\Users\lenovo\.antigravity-ide\extensions\redhat.java-1.56.0-win32-x64\jre\21.0.12.1-win32-x86_64\bin\java.exe"
$backend = "d:\E\3rd Sem capston project\SmartEats\backend"

# 1. Check & start Auth Service (:8081)
$authPort = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue
if (-not $authPort) {
    $cmdAuth = "`"$java`" -Xms64m -Xmx256m -Dlogging.file.name=auth-service.log -Dspring.kafka.bootstrap-servers=localhost:9092 -jar auth-service/target/auth-service-0.0.1-SNAPSHOT.jar"
    $resAuth = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
        CommandLine = $cmdAuth
        CurrentDirectory = $backend
    }
    Write-Host "Auth Service (:8081) spawned with PID: $($resAuth.ProcessId)"
} else {
    Write-Host "Auth Service (:8081) is already running."
}

# 2. Check & start Order Service (:8083)
$orderPort = Get-NetTCPConnection -LocalPort 8083 -ErrorAction SilentlyContinue
if (-not $orderPort) {
    $cmdOrder = "`"$java`" -Xms64m -Xmx256m -Dlogging.file.name=order-service.log -Dspring.data.redis.host=localhost -Dspring.kafka.bootstrap-servers=localhost:9092 -jar order-service/target/order-service-0.0.1-SNAPSHOT.jar"
    $resOrder = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
        CommandLine = $cmdOrder
        CurrentDirectory = $backend
    }
    Write-Host "Order Service (:8083) spawned with PID: $($resOrder.ProcessId)"
} else {
    Write-Host "Order Service (:8083) is already running."
}
