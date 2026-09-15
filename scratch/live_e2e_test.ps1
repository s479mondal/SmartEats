# Live SmartEats Complete E2E Verification Script
$Gateway = "http://localhost:8080"
$ErrorActionPreference = "Stop"

Write-Host "=== 1. TEST ACCOUNTS & AUTHENTICATION ==="
$rand = Get-Random -Minimum 1000 -Maximum 9999
$custEmail = "customer_$rand@smarteats.com"
$restOwnerEmail = "owner_$rand@smarteats.com"
$driverEmail = "driver_$rand@smarteats.com"
$ngoEmail = "ngo_$rand@smarteats.com"
$pass = "Password123!"

# Customer Registration & Login
$custRegBody = @{
    name = "Test Customer"
    email = $custEmail
    password = $pass
    phone = "9876543210"
    address = "123 Main St"
    roles = @("ROLE_CUSTOMER")
} | ConvertTo-Json

try {
    $custReg = Invoke-RestMethod -Uri "$Gateway/api/auth/register" -Method Post -Body $custRegBody -ContentType "application/json"
    Write-Host "Customer Registered: $($custReg.message)"
} catch {
    Write-Host "Customer Register Error: $($_.Exception.Message)"
}

$custLoginBody = @{ email = $custEmail; password = $pass } | ConvertTo-Json
try {
    $custLogin = Invoke-RestMethod -Uri "$Gateway/api/auth/login" -Method Post -Body $custLoginBody -ContentType "application/json"
    $custToken = $custLogin.data.token
    Write-Host "Customer Logged In! Token Present? $([bool]$custToken)"
} catch {
    Write-Host "Customer Login Error: $($_.Exception.Message)"
}

# Restaurant Owner Registration & Login
$ownerRegBody = @{
    name = "Test Owner"
    email = $restOwnerEmail
    password = $pass
    phone = "9876543211"
    address = "456 Market St"
    roles = @("ROLE_RESTAURANT_OWNER")
    restaurantName = "Test Biryani House"
    cuisineType = "Indian"
    latitude = 12.9716
    longitude = 77.5946
} | ConvertTo-Json

try {
    $ownerReg = Invoke-RestMethod -Uri "$Gateway/api/auth/register" -Method Post -Body $ownerRegBody -ContentType "application/json"
    Write-Host "Owner Registered: $($ownerReg.message)"
} catch {
    Write-Host "Owner Register Error: $($_.Exception.Message)"
}

$ownerLoginBody = @{ email = $restOwnerEmail; password = $pass } | ConvertTo-Json
try {
    $ownerLogin = Invoke-RestMethod -Uri "$Gateway/api/auth/login" -Method Post -Body $ownerLoginBody -ContentType "application/json"
    $ownerToken = $ownerLogin.data.token
    Write-Host "Owner Logged In! Token Present? $([bool]$ownerToken)"
} catch {
    Write-Host "Owner Login Error: $($_.Exception.Message)"
}

# Driver Registration & Login
$driverRegBody = @{
    name = "Test Driver"
    email = $driverEmail
    password = $pass
    phone = "9876543212"
    address = "789 Speed St"
    roles = @("ROLE_DELIVERY_PARTNER")
    vehicleType = "Bike"
    vehicleNumber = "KA-01-AB-1234"
} | ConvertTo-Json

try {
    $driverReg = Invoke-RestMethod -Uri "$Gateway/api/auth/register" -Method Post -Body $driverRegBody -ContentType "application/json"
    Write-Host "Driver Registered: $($driverReg.message)"
} catch {
    Write-Host "Driver Register Error: $($_.Exception.Message)"
}

$driverLoginBody = @{ email = $driverEmail; password = $pass } | ConvertTo-Json
try {
    $driverLogin = Invoke-RestMethod -Uri "$Gateway/api/auth/login" -Method Post -Body $driverLoginBody -ContentType "application/json"
    $driverToken = $driverLogin.data.token
    Write-Host "Driver Logged In! Token Present? $([bool]$driverToken)"
} catch {
    Write-Host "Driver Login Error: $($_.Exception.Message)"
}

Write-Host "`n=== 2. RESTAURANTS & MENU BROWSE ==="
$headersCust = @{ Authorization = "Bearer $custToken" }
try {
    $restaurants = Invoke-RestMethod -Uri "$Gateway/api/restaurants" -Headers $headersCust -Method Get
    Write-Host "Active Restaurants Found: $($restaurants.data.Count)"
    if ($restaurants.data.Count -gt 0) {
        $rest = $restaurants.data[0]
        Write-Host "First Restaurant: $($rest.name) (ID: $($rest.id))"
        $menu = Invoke-RestMethod -Uri "$Gateway/api/restaurants/$($rest.id)/menu" -Headers $headersCust -Method Get
        Write-Host "Menu Items Count: $($menu.data.Count)"
    }
} catch {
    Write-Host "Browse Restaurants Error: $($_.Exception.Message)"
}

Write-Host "`n=== 3. RDSS AI FORECAST & SURPLUS ==="
try {
    $forecast = Invoke-RestMethod -Uri "$Gateway/api/rdss/forecast?restaurant_id=rest-101" -Method Get
    Write-Host "RDSS Forecast Meals: $($forecast.totalForecastedMeals), Confidence: $($forecast.confidenceScore)"
} catch {
    Write-Host "RDSS Forecast Error: $($_.Exception.Message)"
}

try {
    $surplusBody = @{
        restaurant_id = "rest-101"
        current_inventory = 100
        expected_demand = 40
        item_name = "Chicken Biryani"
        original_price = 250.0
        expiry_hours = 4.0
    } | ConvertTo-Json
    $surplus = Invoke-RestMethod -Uri "$Gateway/api/rdss/surplus-check" -Method Post -Body $surplusBody -ContentType "application/json"
    Write-Host "RDSS Surplus Check Result: SurplusDetected=$($surplus.surplusDetected), DiscountPercent=$($surplus.discountPercent)%, WastePrevented=$($surplus.estimatedWastePreventedKg)kg"
} catch {
    Write-Host "RDSS Surplus Check Error: $($_.Exception.Message)"
}

Write-Host "`n=== 4. FOOD RESCUE & NGO CHECK ==="
try {
    $rescue = Invoke-WebRequest -Uri "$Gateway/api/rescue/offers" -Method Get -ErrorAction SilentlyContinue
    Write-Host "Food Rescue Offers Endpoint: HTTP $($rescue.StatusCode)"
} catch {
    Write-Host "Food Rescue Offers Endpoint: HTTP $($_.Exception.Response.StatusCode.value__) ($($_.Exception.Message))"
}

Write-Host "`n=== 5. RBAC & UNAUTHORIZED REQUEST SECURITY ==="
try {
    $adminCall = Invoke-WebRequest -Uri "$Gateway/api/admin/users" -Headers $headersCust -Method Get -ErrorAction SilentlyContinue
    Write-Host "Customer -> Admin API: HTTP $($adminCall.StatusCode)"
} catch {
    Write-Host "Customer -> Admin API: HTTP $($_.Exception.Response.StatusCode.value__) ($($_.Exception.Message))"
}
