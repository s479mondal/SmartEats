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
          resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw: body });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
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

  if (regRes.status !== 200 && regRes.status !== 201 && !(regRes.status === 400 && regRes.body?.message?.includes('already registered'))) {
    throw new Error(`Registration failed: status=${regRes.status}, body=${JSON.stringify(regRes.body)}`);
  }

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

async function runStep83CVerification() {
  console.log('===============================================================');
  console.log('🧪 SMART EATS - STEP 8.3C CUSTOMER LIVE MAP & GPS VERIFICATION');
  console.log('===============================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Static Audit of Frontend Map Components
  console.log('\n1. Auditing LiveDeliveryMap.jsx & OrderTrackingView.jsx...');
  const mapCode = fs.readFileSync('frontend/src/components/customer/LiveDeliveryMap.jsx', 'utf8');
  const viewCode = fs.readFileSync('frontend/src/components/customer/OrderTrackingView.jsx', 'utf8');

  assert(
    mapCode.includes('MapContainer') && mapCode.includes('TileLayer') && mapCode.includes('Marker'),
    'LiveDeliveryMap uses Leaflet MapContainer, TileLayer, and Marker'
  );

  assert(
    mapCode.includes('restaurantIcon') && mapCode.includes('customerIcon') && mapCode.includes('driverLiveIcon'),
    'LiveDeliveryMap defines distinct icons for Restaurant 🍲, Customer 🏠, and Driver 🛵'
  );

  assert(
    mapCode.includes('hasLiveDriver') && mapCode.includes('driverLat != null && driverLng != null'),
    'LiveDeliveryMap renders driver marker ONLY when live GPS coordinates are available'
  );

  assert(
    mapCode.includes('secondsDiff <= 60') && mapCode.includes('Live (Updated'),
    'LiveDeliveryMap implements 0-60s Live vs Slow/Stale telemetry freshness logic'
  );

  assert(
    viewCode.includes('<LiveDeliveryMap') &&
    viewCode.includes('delivery={delivery}'),
    'OrderTrackingView integrates LiveDeliveryMap with live delivery data'
  );

  assert(
    viewCode.includes('combinedStatus.isTerminal') && viewCode.includes('clearInterval(pollingTimerRef.current)'),
    'OrderTrackingView halts live polling on terminal states (DELIVERED, CANCELLED, REJECTED)'
  );

  // 2. End-to-End Live Order, Driver Assignment, and Live GPS Movement
  console.log('\n2. Live Order Creation & Driver Assignment...');
  const timestamp = Date.now();
  const custEmailA = `cust_map_a_${timestamp}@smarteats.com`;
  const custEmailB = `cust_map_b_${timestamp}@smarteats.com`;
  const driverEmailA = `driver_map_a_${timestamp}@smarteats.com`;

  const tokenCustA = await registerAndLogin(custEmailA, 'CUSTOMER', {
    deliveryAddress: 'Domlur Layout, 100ft Road, Bengaluru',
    customerLatitude: 12.9600,
    customerLongitude: 77.6400
  });

  const tokenCustB = await registerAndLogin(custEmailB, 'CUSTOMER', {
    deliveryAddress: 'Jayanagar 4th Block, Bengaluru',
    customerLatitude: 12.9250,
    customerLongitude: 77.5850
  });

  const tokenDriverA = await registerAndLogin(driverEmailA, 'DELIVERY_PARTNER', {
    vehicleType: 'MOTORCYCLE',
    vehicleNumber: 'KA-04-MAP-1111',
    drivingLicenseNumber: 'DL-KA04-1111111',
    driverBaseAddress: 'Indiranagar Base Station',
    driverCity: 'Bengaluru',
    driverState: 'Karnataka',
    driverPincode: '560038',
    driverBaseLatitude: 12.9784,
    driverBaseLongitude: 77.6408
  });

  const tokenRest = await registerAndLogin('restaurant@smarteats.com', 'RESTAURANT_OWNER');

  // Customer A adds item to cart and places order
  await request(
    {
      hostname: 'localhost',
      port: 8080,
      path: '/api/orders/cart?restaurantId=rest_101',
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenCustA}`, 'Content-Type': 'application/json' }
    },
    { menuItemId: 'item_502', itemId: 'item_502', quantity: 1, price: 299, name: 'Artisan Truffle Burger' }
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

  assert(orderRes.status === 200 || orderRes.status === 201, 'Customer A placed COD order');
  const orderId = orderRes.body?.data?.id || orderRes.body?.id;
  console.log(`   Order ID: #${orderId}`);

  // Restaurant accepts order
  const acceptRes = await request(
    {
      hostname: 'localhost',
      port: 8080,
      path: `/api/orders/my/orders/${orderId}/accept`,
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenRest}` }
    }
  );
  assert(acceptRes.status === 200, 'Restaurant owner accepted order');

  // Driver A goes ONLINE
  await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/deliveries/partner/availability?active=true&available=true',
    method: 'PUT',
    headers: { Authorization: `Bearer ${tokenDriverA}` }
  });

  // Fetch Delivery record for Order A
  const deliveryRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/deliveries/order/${orderId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenCustA}` }
  });

  assert(deliveryRes.status === 200, 'Customer A retrieved delivery record for own order');
  let delivery = deliveryRes.body?.data;
  assert(delivery?.restaurantLatitude != null && delivery?.restaurantLongitude != null, 'Delivery response contains restaurant coordinates');
  assert(delivery?.deliveryLatitude != null && delivery?.deliveryLongitude != null, 'Delivery response contains delivery dropoff coordinates');

  const deliveryId = delivery.id;

  // Driver A accepts the delivery assignment
  const acceptDelRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/deliveries/${deliveryId}/accept`,
    method: 'PUT',
    headers: { Authorization: `Bearer ${tokenDriverA}` }
  });
  assert(acceptDelRes.status === 200, 'Driver A accepted delivery assignment');
  delivery = acceptDelRes.body?.data;
  console.log(`   Assigned Delivery Partner: ${delivery.deliveryPartnerEmail}`);
  const assignedDriverToken = tokenDriverA;

  // 3. Driver Live GPS Telemetry Update 1
  console.log('\n3. Assigned Driver sends GPS Beacon 1 (12.9800, 77.7300, acc=5.5m)...');
  const loc1Res = await request(
    {
      hostname: 'localhost',
      port: 8080,
      path: '/api/deliveries/partner/location',
      method: 'POST',
      headers: { Authorization: `Bearer ${assignedDriverToken}`, 'Content-Type': 'application/json' }
    },
    { latitude: 12.9800, longitude: 77.7300, accuracy: 5.5 }
  );
  assert(loc1Res.status === 200, 'Driver location beacon 1 accepted');

  // Customer A polls delivery endpoint and verifies live driver coordinates
  const customerPoll1 = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/deliveries/order/${orderId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenCustA}` }
  });

  const poll1Data = customerPoll1.body?.data;
  assert(
    poll1Data?.driverCurrentLatitude === 12.9800 && poll1Data?.driverCurrentLongitude === 77.7300,
    'Customer receives driver live operational coordinates (12.9800, 77.7300)'
  );
  assert(
    poll1Data?.driverLastLocationUpdate != null,
    'Customer receives driver lastLocationUpdate server timestamp'
  );
  assert(
    poll1Data?.driverLocationAccuracyMeters === 5.5,
    'Customer receives driver locationAccuracyMeters (5.5m)'
  );

  // 4. Driver Live GPS Telemetry Update 2 (Movement)
  console.log('\n4. Assigned Driver moves and sends GPS Beacon 2 (12.9865, 77.7350, acc=3.8m)...');
  const loc2Res = await request(
    {
      hostname: 'localhost',
      port: 8080,
      path: '/api/deliveries/partner/location',
      method: 'POST',
      headers: { Authorization: `Bearer ${assignedDriverToken}`, 'Content-Type': 'application/json' }
    },
    { latitude: 12.9865, longitude: 77.7350, accuracy: 3.8 }
  );
  assert(loc2Res.status === 200, 'Driver location beacon 2 accepted');

  // Customer A polls delivery endpoint again
  const customerPoll2 = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/deliveries/order/${orderId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenCustA}` }
  });

  const poll2Data = customerPoll2.body?.data;
  assert(
    poll2Data?.driverCurrentLatitude === 12.9865 && poll2Data?.driverCurrentLongitude === 77.7350,
    'Customer map marker coordinates dynamically updated after movement (12.9865, 77.7350)'
  );

  // 5. Security & Cross-Customer Isolation Testing
  console.log('\n5. Security & IDOR Prevention Tests...');

  // 5a. Customer B (unrelated customer) attempts to view Customer A's delivery tracking
  const idorRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/deliveries/order/${orderId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenCustB}` }
  });
  assert(
    idorRes.status === 403,
    'Cross-customer IDOR prevented: Customer B receives HTTP 403 Forbidden attempting to access Customer A tracking data'
  );

  // 5b. Unauthenticated request
  const unauthRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/deliveries/order/${orderId}`,
    method: 'GET'
  });
  assert(
    unauthRes.status === 401,
    'Unauthenticated request receives HTTP 401 Unauthorized'
  );

  // 6. Complete Order Lifecycle to DELIVERED
  console.log('\n6. Advancing Delivery Lifecycle to DELIVERED...');
  // Delivery is ASSIGNED -> Picked Up -> Out for Delivery -> Delivered
  await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/deliveries/${deliveryId}/status?status=PICKED_UP`,
    method: 'PUT',
    headers: { Authorization: `Bearer ${assignedDriverToken}` }
  });

  await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/deliveries/${deliveryId}/status?status=OUT_FOR_DELIVERY`,
    method: 'PUT',
    headers: { Authorization: `Bearer ${assignedDriverToken}` }
  });

  const delFinalRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/deliveries/${deliveryId}/status?status=DELIVERED`,
    method: 'PUT',
    headers: { Authorization: `Bearer ${assignedDriverToken}` }
  });

  assert(delFinalRes.status === 200, 'Delivery marked DELIVERED');

  console.log('\n===============================================================');
  console.log(`🏆 STEP 8.3C TEST SUITE COMPLETE: ${passed} passed, ${failed} failed`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runStep83CVerification().catch((err) => {
  console.error('\n❌ STEP 8.3C VERIFICATION FAILED:', err);
  process.exit(1);
});
