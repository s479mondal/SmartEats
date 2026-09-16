$java = "C:\Users\lenovo\.antigravity-ide\extensions\redhat.java-1.56.0-win32-x64\jre\21.0.12.1-win32-x86_64\bin\java.exe"
$backend = "d:\E\3rd Sem capston project\SmartEats\backend"
$cmd = "cmd.exe /c `"`"$java`" -Xms64m -Xmx256m -Dspring.data.redis.host=localhost -Dspring.kafka.bootstrap-servers=localhost:9092 -jar order-service/target/order-service-0.0.1-SNAPSHOT.jar > order-service.log 2>&1`""

$res = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
    CommandLine = $cmd
    CurrentDirectory = $backend
}
Write-Host "Spawned Order Service with PID: $($res.ProcessId)"
