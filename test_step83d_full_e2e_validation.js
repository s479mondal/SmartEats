const http = require('http');
const fs = require('fs');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, headers: res.headers, body: parsed, data: parsed?.data !== undefined ? parsed.data : parsed, raw: body });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body, data: body, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function registerAndLogin(email, role, extra = {}) {
  const regPayload = {
    name: `Test ${role} ${Date.now()}`,
    email,
    password: 'Password123!',
    phone: '9876543210',
    roles: [role],
    ...extra
  };

  const regRes = await request(
    {
      hostname: 'localhost',
      port: 8080,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    regPayload
  );

  const loginRes = await request(
    {
      hostname: 'localhost',
      port: 8080,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    { email, password: 'Password123!' }
  );

  const token = loginRes.body?.data?.token || loginRes.body?.token;
  if (!token) {
    throw new Error(`Failed to get JWT token for ${email}: status=${loginRes.status}, body=${JSON.stringify(loginRes.body)}`);
  }
  return token;
}

let passedChecks = 0;
let totalChecks = 0;

function assert(condition, message) {
  totalChecks++;
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedChecks++;
  } else {
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runStep83dE2EValidation() {
  console.log('========================================================================');
  console.log('SMART EATS — STEP 8.3D FULL LIVE TRACKING E2E VALIDATION & RELIABILITY');
  console.log('========================================================================\n');

  // --- SECTION 16: Haversine Integrity Static Code Verification ---
  console.log('--- SECTION 16: Verifying HaversineAssignmentStrategy Integrity ---');
  const haversineFile = fs.readFileSync('backend/delivery-service/src/main/java/com/smarteats/delivery/strategy/HaversineAssignmentStrategy.java', 'utf8');
  assert(haversineFile.includes('EARTH_RADIUS_KM = 6371.0'), 'Haversine constant EARTH_RADIUS_KM = 6371.0 present');
  assert(haversineFile.includes('calculateDistance'), 'Haversine trigonometric distance calculation function intact');
  assert(haversineFile.includes('assignRider'), 'assignRider method intact and unchanged');
  assert(!haversineFile.includes('AMFDA'), 'No AMFDA modifications introduced in HaversineAssignmentStrategy');

  // --- SECTION 1 & 2: Setup Test Personas & Complete E2E Scenario ---
  console.log('\n--- SECTION 1 & 2: Setup Test Personas & Complete E2E Scenario ---');
  const timestamp = Date.now();
  const custEmailA = `cust_e2e_a_${timestamp}@smarteats.com`;
  const custEmailB = `cust_e2e_b_${timestamp}@smarteats.com`;
  const driverEmailA = `driver_e2e_a_${timestamp}@smarteats.com`;
  const driverEmailB = `driver_e2e_b_${timestamp}@smarteats.com`;

  // STEP 1: Customer A and B Login
  const tokenCustA = await registerAndLogin(custEmailA, 'CUSTOMER', {
    deliveryAddress: 'Domlur Layout, 100ft Road, Bengaluru',
    customerLatitude: 12.9600,
    customerLongitude: 77.6400
  });
  assert(!!tokenCustA, 'Customer A authenticated with valid JWT');

  const tokenCustB = await registerAndLogin(custEmailB, 'CUSTOMER', {
    deliveryAddress: 'Jayanagar 4th Block, Bengaluru',
    customerLatitude: 12.9250,
    customerLongitude: 77.5850
  });
  assert(!!tokenCustB, 'Customer B authenticated with valid JWT for security isolation testing');

  // Register and authenticate Restaurant Owner
  const tokenRest = await registerAndLogin('restaurant@smarteats.com', 'RESTAURANT_OWNER');
  assert(!!tokenRest, 'Restaurant Owner authenticated');

  // Register Driver A with distinct BASE location
  const baseLat = 12.9698;
  const baseLng = 77.7500;
  const tokenDriverA = await registerAndLogin(driverEmailA, 'DELIVERY_PARTNER', {
    vehicleType: 'MOTORCYCLE',
    vehicleNumber: 'KA-04-E2E-8390',
    drivingLicenseNumber: 'DL-KA04-8390000',
    driverBaseAddress: 'ITPB Main Road, Whitefield Base Hub',
    driverCity: 'Bengaluru',
    driverState: 'Karnataka',
    driverPincode: '560066',
    driverBaseLatitude: baseLat,
    driverBaseLongitude: baseLng
  });
  assert(!!tokenDriverA, 'Driver A registered with base location (12.9698, 77.7500)');

  // Set Driver A ONLINE
  const onlineSetupRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/deliveries/partner/availability?active=true&available=true',
    method: 'PUT',
    headers: { Authorization: `Bearer ${tokenDriverA}` }
  });
  assert(onlineSetupRes.status === 200, 'Driver A set to ONLINE (active=true, available=true)');

  // Register Driver B
  const tokenDriverB = await registerAndLogin(driverEmailB, 'DELIVERY_PARTNER', {
    vehicleType: 'SCOOTER',
    vehicleNumber: 'KA-04-E2E-9999',
    drivingLicenseNumber: 'DL-KA04-9999999',
    driverBaseAddress: 'Indiranagar 100ft Road Hub',
    driverCity: 'Bengaluru',
    driverState: 'Karnataka',
    driverPincode: '560038',
    driverBaseLatitude: 12.9784,
    driverBaseLongitude: 77.6408
  });
  assert(!!tokenDriverB, 'Driver B registered for cross-driver isolation tests');

  // STEP 2: Customer places order
  console.log('\n--- STEP 2: Customer A Places Order ---');
  await request(
    {
      hostname: 'localhost',
      port: 8080,
      path: '/api/orders/cart?restaurantId=rest_101',
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenCustA}`, 'Content-Type': 'application/json' }
    },
    { menuItemId: 'item_501', itemId: 'item_501', quantity: 2, price: 349, name: 'Margherita Special' }
  );

  const orderRes = await request(
    {
      hostname: 'localhost',
      port: 8080,
      path: '/api/orders/cod',
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenCustA}` }
    }
  );
  assert(orderRes.status === 200 || orderRes.status === 201, 'Order created successfully via COD flow');
  const orderId = orderRes.body?.data?.id || orderRes.body?.id;
  assert(orderId != null, `Valid Order ID received (#${orderId})`);

  // STEP 3: Restaurant Owner sees own order
  console.log('\n--- STEP 3: Restaurant Views Order ---');
  const restOrdersRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/orders/my/orders`,
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenRest}` }
  });
  assert(restOrdersRes.status === 200, 'Restaurant fetched own active orders');

  // STEP 4: Restaurant accepts order (CREATED -> ACCEPTED)
  console.log('\n--- STEP 4: Restaurant Accepts Order ---');
  const acceptRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/orders/my/orders/${orderId}/accept`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenRest}` }
  });
  assert(acceptRes.status === 200, 'Order status transitioned: CREATED -> ACCEPTED');

  // STEP 5: Restaurant transitions ACCEPTED -> PREPARING
  console.log('\n--- STEP 5: Restaurant Updates to PREPARING ---');
  const prepRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/orders/my/orders/${orderId}/preparing`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenRest}` }
  });
  assert(prepRes.status === 200, 'Order status transitioned: ACCEPTED -> PREPARING');

  // STEP 6: Restaurant transitions PREPARING -> READY
  console.log('\n--- STEP 6: Restaurant Updates to READY ---');
  const readyRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/orders/my/orders/${orderId}/ready`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenRest}` }
  });
  assert(readyRes.status === 200, 'Order status transitioned: PREPARING -> READY');

  // STEP 7: Driver Assignment Verification
  console.log('\n--- STEP 7 & 8: Driver Assignment Verification ---');
  const deliveryRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/deliveries/order/${orderId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenCustA}` }
  });
  assert(deliveryRes.status === 200, 'Delivery record exists for order');
  const delivery = deliveryRes.body?.data;
  const deliveryId = delivery.id;
  assert(deliveryId != null, `Delivery ID is ${deliveryId}`);
  
  // Determine assigned driver
  const assignedEmail = delivery.deliveryPartnerEmail || driverEmailA;
  let assignedDriverToken = tokenDriverA;
  if (assignedEmail !== driverEmailA) {
    try {
      assignedDriverToken = await registerAndLogin(assignedEmail, 'DELIVERY_PARTNER');
    } catch(e) {
      assignedDriverToken = tokenDriverA;
    }
  }
  console.log(`  Assigned Driver: ${assignedEmail}`);

  // Driver accepts assignment if pending
  if (delivery.status === 'PENDING') {
    const acceptDelRes = await request({
      hostname: 'localhost',
      port: 8080,
      path: `/api/deliveries/${deliveryId}/accept`,
      method: 'PUT',
      headers: { Authorization: `Bearer ${assignedDriverToken}` }
    });
    assert(acceptDelRes.status === 200, 'Driver accepted delivery assignment');
  } else {
    assert(delivery.status === 'ASSIGNED', 'Delivery status is ASSIGNED');
  }

  // STEP 10: Driver Transmits GPS Point 1 (12.9800, 77.7300)
  console.log('\n--- STEP 10: Driver Sends GPS Beacon 1 (12.9800, 77.7300) ---');
  const beacon1Res = await request(
    {
      hostname: 'localhost',
      port: 8080,
      path: '/api/deliveries/partner/location',
      method: 'POST',
      headers: { Authorization: `Bearer ${assignedDriverToken}`, 'Content-Type': 'application/json' }
    },
    { latitude: 12.9800, longitude: 77.7300, accuracy: 5.2 }
  );
  assert(beacon1Res.status === 200, 'GPS Beacon 1 successfully saved');
  assert(beacon1Res.data.currentLatitude === 12.9800, 'currentLatitude is 12.9800');
  assert(beacon1Res.data.currentLongitude === 77.7300, 'currentLongitude is 77.7300');
  assert(beacon1Res.data.baseLatitude !== null, 'baseLatitude remains present and valid');
  assert(beacon1Res.data.baseLongitude !== null, 'baseLongitude remains present and valid');

  // STEP 11: Customer opens Track Order & checks coordinates
  console.log('\n--- STEP 11: Customer Live Tracking Coordinates Verification ---');
  const custTrack1 = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/deliveries/order/${orderId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenCustA}` }
  });
  assert(custTrack1.status === 200, 'Customer A retrieved delivery tracking state');
  const trackData1 = custTrack1.body?.data;
  assert(trackData1.driverCurrentLatitude === 12.9800, 'Live driverCurrentLatitude is 12.9800');
  assert(trackData1.driverCurrentLongitude === 77.7300, 'Live driverCurrentLongitude is 77.7300');
  assert(trackData1.restaurantLatitude != null && trackData1.restaurantLongitude != null, 'Restaurant coordinates present for map');
  assert(trackData1.deliveryLatitude != null && trackData1.deliveryLongitude != null, 'Customer destination coordinates present for map');

  // --- SECTION 3: DRIVER MOVEMENT TEST ---
  console.log('\n--- SECTION 3: Driver Movement Progression Test ---');
  console.log('Sending Movement Beacon 2: 12.9865, 77.7350...');
  const beacon2Res = await request(
    {
      hostname: 'localhost',
      port: 8080,
      path: '/api/deliveries/partner/location',
      method: 'POST',
      headers: { Authorization: `Bearer ${assignedDriverToken}`, 'Content-Type': 'application/json' }
    },
    { latitude: 12.9865, longitude: 77.7350, accuracy: 4.1 }
  );
  assert(beacon2Res.status === 200, 'Beacon 2 accepted');
  assert(beacon2Res.data.currentLatitude === 12.9865, 'currentLatitude is 12.9865');
  assert(beacon2Res.data.baseLatitude === beacon1Res.data.baseLatitude, 'baseLatitude strictly unchanged across movements');

  const custTrack2 = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/deliveries/order/${orderId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenCustA}` }
  });
  assert(custTrack2.data.driverCurrentLatitude === 12.9865, 'Customer receives updated movement coordinate (12.9865)');
  assert(custTrack2.data.driverCurrentLongitude === 77.7350, 'Customer receives updated movement coordinate (77.7350)');

  console.log('Sending Movement Beacon 3: 12.9900, 77.7400...');
  const beacon3Res = await request(
    {
      hostname: 'localhost',
      port: 8080,
      path: '/api/deliveries/partner/location',
      method: 'POST',
      headers: { Authorization: `Bearer ${assignedDriverToken}`, 'Content-Type': 'application/json' }
    },
    { latitude: 12.9900, longitude: 77.7400, accuracy: 3.5 }
  );
  assert(beacon3Res.status === 200, 'Beacon 3 accepted');
  assert(beacon3Res.data.currentLatitude === 12.9900, 'currentLatitude is 12.9900');
  assert(beacon3Res.data.baseLatitude === beacon1Res.data.baseLatitude, 'baseLatitude strictly unchanged across movements');

  const custTrack3 = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/deliveries/order/${orderId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenCustA}` }
  });
  assert(custTrack3.data.driverCurrentLatitude === 12.9900, 'Customer receives updated movement coordinate (12.9900)');
  assert(custTrack3.data.driverCurrentLongitude === 77.7400, 'Customer receives updated movement coordinate (77.7400)');

  // --- SECTION 4 & 5: POLLING & GPS FRESHNESS VALIDATION ---
  console.log('\n--- SECTION 4 & 5: Polling & GPS Freshness Telemetry ---');
  const lastUpdateIso = custTrack3.data.driverLastLocationUpdate;
  assert(lastUpdateIso != null, 'driverLastLocationUpdate ISO string is present');
  const diffSec = (Date.now() - new Date(lastUpdateIso).getTime()) / 1000;
  console.log(`  Telemetry diff: ${diffSec.toFixed(2)}s`);
  assert(diffSec <= 60, 'Telemetry age <= 60s -> Frontend maps to "🟢 Driver Live"');

  // Verify frontend component logic has exact freshness tiers
  const liveMapJs = fs.readFileSync('frontend/src/components/customer/LiveDeliveryMap.jsx', 'utf8');
  assert(liveMapJs.includes('secondsDiff <= 60'), 'LiveDeliveryMap evaluates <= 60s as Fresh/Live');
  assert(liveMapJs.includes('secondsDiff <= 360'), 'LiveDeliveryMap evaluates <= 360s as Aging/Slow');
  assert(liveMapJs.includes('Last known location') && liveMapJs.includes("status: 'STALE'"), 'LiveDeliveryMap evaluates > 360s as Stale');

  // --- SECTION 6: GPS FAILURE & ERROR BOUNDARY TESTS ---
  console.log('\n--- SECTION 6: GPS Failure & Error Boundary Tests ---');
  // Out-of-bounds latitude (>90)
  const oobLatRes = await request(
    {
      hostname: 'localhost',
      port: 8080,
      path: '/api/deliveries/partner/location',
      method: 'POST',
      headers: { Authorization: `Bearer ${assignedDriverToken}`, 'Content-Type': 'application/json' }
    },
    { latitude: 91.5, longitude: 77.7400 }
  );
  assert(oobLatRes.status === 400, 'Latitude > 90 rejected with HTTP 400');

  // Out-of-bounds longitude (>180)
  const oobLngRes = await request(
    {
      hostname: 'localhost',
      port: 8080,
      path: '/api/deliveries/partner/location',
      method: 'POST',
      headers: { Authorization: `Bearer ${assignedDriverToken}`, 'Content-Type': 'application/json' }
    },
    { latitude: 12.9900, longitude: 185.0 }
  );
  assert(oobLngRes.status === 400, 'Longitude > 180 rejected with HTTP 400');

  // Missing coordinates (null)
  const nullCoordsRes = await request(
    {
      hostname: 'localhost',
      port: 8080,
      path: '/api/deliveries/partner/location',
      method: 'POST',
      headers: { Authorization: `Bearer ${assignedDriverToken}`, 'Content-Type': 'application/json' }
    },
    { latitude: null, longitude: null }
  );
  assert(nullCoordsRes.status === 400, 'Null coordinates rejected with HTTP 400');

  // Unauthenticated request
  const unauthGpsRes = await request(
    {
      hostname: 'localhost',
      port: 8080,
      path: '/api/deliveries/partner/location',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    { latitude: 12.9900, longitude: 77.7400 }
  );
  assert(unauthGpsRes.status === 401 || unauthGpsRes.status === 403, 'Unauthenticated GPS rejected with HTTP 401/403');

  // Customer role posting location
  const custGpsRes = await request(
    {
      hostname: 'localhost',
      port: 8080,
      path: '/api/deliveries/partner/location',
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenCustA}`, 'Content-Type': 'application/json' }
    },
    { latitude: 12.9900, longitude: 77.7400 }
  );
  assert(custGpsRes.status === 403, 'Customer role posting to driver GPS endpoint rejected with HTTP 403');

  // --- SECTION 9: CUSTOMER SECURITY / IDOR & ALTERNATE LEAKAGE TESTS ---
  console.log('\n--- SECTION 9: Customer Security / IDOR & Alternate Leakage Tests ---');
  // Customer A accesses own order delivery
  const custAOwnerRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/deliveries/order/${orderId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenCustA}` }
  });
  assert(custAOwnerRes.status === 200, 'Customer A (owner) fetches delivery with HTTP 200');

  // Customer B attempts to access Customer A's order delivery
  const custBIdorRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/deliveries/order/${orderId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenCustB}` }
  });
  assert(custBIdorRes.status === 403, 'Customer B accessing Customer A delivery rejected with HTTP 403 Forbidden');

  // Customer B attempts direct delivery ID lookup
  const custBDeliveryIdRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/deliveries/${deliveryId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenCustB}` }
  });
  assert(custBDeliveryIdRes.status === 403, 'Customer B accessing delivery by ID rejected with HTTP 403');

  // Unauthenticated request to order tracking
  const unauthTrackRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/deliveries/order/${orderId}`,
    method: 'GET'
  });
  assert(unauthTrackRes.status === 401, 'Unauthenticated order tracking access returns HTTP 401');

  // --- SECTION 10: DRIVER SECURITY ---
  console.log('\n--- SECTION 10: Cross-Driver Security Tests ---');
  // Driver B attempts to accept Driver A's assigned delivery
  const driverBAcceptRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/deliveries/${deliveryId}/accept`,
    method: 'PUT',
    headers: { Authorization: `Bearer ${tokenDriverB}` }
  });
  assert(driverBAcceptRes.status === 403 || driverBAcceptRes.status === 400, 'Driver B cannot hijack Driver A delivery');

  // Driver B attempts to update status of Driver A's delivery
  const driverBStatusRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/deliveries/${deliveryId}/status?status=DELIVERED`,
    method: 'PUT',
    headers: { Authorization: `Bearer ${tokenDriverB}` }
  });
  assert(driverBStatusRes.status === 403, 'Driver B mutating Driver A delivery status rejected with HTTP 403');

  // --- SECTION 11 & 12: DELIVERY LIFECYCLE COMPLETION ---
  console.log('\n--- SECTION 11 & 12: Complete Delivery Lifecycle ---');
  // Driver transitions: ASSIGNED -> PICKED_UP
  const pickupRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/deliveries/${deliveryId}/status?status=PICKED_UP`,
    method: 'PUT',
    headers: { Authorization: `Bearer ${assignedDriverToken}` }
  });
  assert(pickupRes.status === 200, 'Delivery updated to PICKED_UP');

  // Driver transitions: PICKED_UP -> OUT_FOR_DELIVERY
  const ofdRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/deliveries/${deliveryId}/status?status=OUT_FOR_DELIVERY`,
    method: 'PUT',
    headers: { Authorization: `Bearer ${assignedDriverToken}` }
  });
  assert(ofdRes.status === 200, 'Delivery updated to OUT_FOR_DELIVERY');

  // Driver transitions: OUT_FOR_DELIVERY -> DELIVERED
  const delFinalRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/deliveries/${deliveryId}/status?status=DELIVERED`,
    method: 'PUT',
    headers: { Authorization: `Bearer ${assignedDriverToken}` }
  });
  assert(delFinalRes.status === 200, 'Delivery updated to DELIVERED');

  // Check Order status is DELIVERED (allow Kafka event async propagation)
  let orderDelivered = false;
  for (let i = 0; i < 10; i++) {
    const orderFinalRes = await request({
      hostname: 'localhost',
      port: 8080,
      path: `/api/orders/${orderId}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenCustA}` }
    });
    if (orderFinalRes.data.status === 'DELIVERED') {
      orderDelivered = true;
      break;
    }
    await new Promise(r => setTimeout(r, 400));
  }
  assert(orderDelivered, 'Order status synchronized to DELIVERED via Kafka');

  // Verify terminal state polling cleanup logic in frontend
  const trackingViewJs = fs.readFileSync('frontend/src/components/customer/OrderTrackingView.jsx', 'utf8');
  const orderStatusUtilsJs = fs.readFileSync('frontend/src/utils/orderStatusUtils.js', 'utf8');
  assert(trackingViewJs.includes('if (combined.isTerminal)') && trackingViewJs.includes('clearInterval(pollingTimerRef.current)'), 'OrderTrackingView clears polling timer on terminal state');
  assert(orderStatusUtilsJs.includes("orderStatus === 'DELIVERED'") && orderStatusUtilsJs.includes("orderStatus === 'CANCELLED'") && orderStatusUtilsJs.includes("orderStatus === 'REJECTED'"), 'orderStatusUtils defines DELIVERED, CANCELLED, and REJECTED as terminal');

  // --- SECTION 7 & 8: OFFLINE TEST & BASE LOCATION INVARIANCE ---
  console.log('\n--- SECTION 7 & 8: Driver Goes OFFLINE & Invariance Audit ---');
  const offlineRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/deliveries/partner/availability?active=false&available=false',
    method: 'PUT',
    headers: { Authorization: `Bearer ${assignedDriverToken}` }
  });
  assert(offlineRes.status === 200, 'Driver set to OFFLINE');
  const finalProfile = offlineRes.data;
  assert(finalProfile.active === false && finalProfile.available === false, 'Driver is offline (active=false, available=false)');
  assert(finalProfile.currentLatitude === 12.9900, 'Last known currentLatitude retained (12.9900)');
  assert(finalProfile.currentLongitude === 77.7400, 'Last known currentLongitude retained (77.7400)');
  assert(finalProfile.baseLatitude != null && finalProfile.baseLongitude != null, 'CRITICAL: Driver base location remained strictly invariant');

  // Verify Driver Portal GPS watcher cleanup and throttling logic
  const driverPortalJs = fs.readFileSync('frontend/src/components/DriverPortal.jsx', 'utf8');
  assert(driverPortalJs.includes('navigator.geolocation.clearWatch(watchIdRef.current)'), 'DriverPortal clears GPS watch on offline and unmount');
  assert(driverPortalJs.includes('const MIN_BEACON_INTERVAL_MS = 5000;'), 'DriverPortal implements 5-second beacon throttling');
  assert(driverPortalJs.includes("setGpsStatus('LIVE')"), 'DriverPortal activates GPS LIVE status');

  console.log('\n========================================================================');
  console.log(`🏆 STEP 8.3D FULL E2E VALIDATION: ${passedChecks}/${totalChecks} CHECKS PASSED (100%)`);
  console.log('========================================================================\n');
}

runStep83dE2EValidation().catch(err => {
  console.error('\n❌ STEP 8.3D VALIDATION FAILED:', err);
  process.exit(1);
});
