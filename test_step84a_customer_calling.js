const http = require('http');
const fs = require('fs');

// Load phoneUtils dynamically
const { cleanTelUri, formatIndianPhone } = require('./frontend/src/utils/phoneUtils.js');

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

async function runStep84aVerification() {
  console.log('========================================================================');
  console.log('SMART EATS — STEP 8.4A CUSTOMER CONTACT / CALLING TEST SUITE');
  console.log('========================================================================\n');

  // --- SECTION 1: Phone Utility Unit Tests ---
  console.log('--- SECTION 1: Phone Utility Unit Tests ---');
  assert(cleanTelUri('9876543210') === 'tel:+919876543210', '1. cleanTelUri("9876543210") -> "tel:+919876543210"');
  assert(cleanTelUri('+91 98765 43210') === 'tel:+919876543210', '2. cleanTelUri("+91 98765 43210") -> "tel:+919876543210"');
  assert(cleanTelUri('+919876543210') === 'tel:+919876543210', '3. cleanTelUri("+919876543210") -> "tel:+919876543210"');
  assert(cleanTelUri('09876543210') === 'tel:+919876543210', '4. cleanTelUri("09876543210") with leading 0 -> "tel:+919876543210"');
  assert(cleanTelUri('91-98765-43210') === 'tel:+919876543210', '5. cleanTelUri("91-98765-43210") with hyphens -> "tel:+919876543210"');
  assert(cleanTelUri(null) === null, '6. cleanTelUri(null) -> null');
  assert(cleanTelUri('') === null, '7. cleanTelUri("") -> null');
  assert(cleanTelUri(undefined) === null, '8. cleanTelUri(undefined) -> null');
  assert(cleanTelUri('   ') === null, '9. cleanTelUri("   ") whitespace -> null');
  assert(cleanTelUri('invalid-phone') === null, '10. cleanTelUri("invalid-phone") non-digits -> null');
  assert(cleanTelUri('12345') === null, '11. cleanTelUri("12345") too short -> null');
  assert(cleanTelUri('12345678901234567890') === null, '12. cleanTelUri(20 digits) too long -> null');

  assert(formatIndianPhone('9876543210') === '+91 98765 43210', '13. formatIndianPhone("9876543210") -> "+91 98765 43210"');
  assert(formatIndianPhone('+919876543210') === '+91 98765 43210', '14. formatIndianPhone("+919876543210") -> "+91 98765 43210"');
  assert(formatIndianPhone('+91 98765 43210') === '+91 98765 43210', '15. formatIndianPhone("+91 98765 43210") -> "+91 98765 43210"');
  assert(formatIndianPhone(null) === 'Phone not available', '16. formatIndianPhone(null) -> "Phone not available"');
  assert(formatIndianPhone('') === 'Phone not available', '17. formatIndianPhone("") -> "Phone not available"');
  assert(formatIndianPhone('invalid') === 'Phone not available', '18. formatIndianPhone("invalid") -> "Phone not available"');

  // --- SECTION 2: Static Code Audit on Frontend Components ---
  console.log('\n--- SECTION 2: Static Code Audit on Frontend Components ---');
  const detailPageCode = fs.readFileSync('frontend/src/pages/customer/RestaurantDetailPage.jsx', 'utf8');
  assert(detailPageCode.includes('cleanTelUri(restaurant.phone)'), 'RestaurantDetailPage checks cleanTelUri before rendering tel link');
  assert(detailPageCode.includes('href={cleanTelUri(restaurant.phone)}'), 'RestaurantDetailPage uses cleanTelUri for href');
  assert(detailPageCode.includes('formatIndianPhone(restaurant.phone)'), 'RestaurantDetailPage formats phone with formatIndianPhone');
  assert(detailPageCode.includes('Phone not available'), 'RestaurantDetailPage provides "Phone not available" fallback');

  const trackingViewCode = fs.readFileSync('frontend/src/components/customer/OrderTrackingView.jsx', 'utf8');
  assert(trackingViewCode.includes('cleanTelUri(restaurant?.phone)'), 'OrderTrackingView checks cleanTelUri for restaurant');
  assert(trackingViewCode.includes('href={cleanTelUri(restaurant.phone)}'), 'OrderTrackingView links Call Restaurant to cleanTelUri');
  assert(trackingViewCode.includes('cleanTelUri(delivery?.driverPhone)'), 'OrderTrackingView checks cleanTelUri for assigned driver');
  assert(trackingViewCode.includes('href={cleanTelUri(delivery.driverPhone)}'), 'OrderTrackingView links Call Driver to cleanTelUri');
  assert(trackingViewCode.includes('Driver phone not available'), 'OrderTrackingView handles missing driver phone safely');
  assert(trackingViewCode.includes('Phone not available'), 'OrderTrackingView handles missing restaurant phone safely');

  // --- SECTION 3: Live E2E Integration & Security Calling Test ---
  console.log('\n--- SECTION 3: Live E2E Calling & Security Verification ---');
  const timestamp = Date.now();
  const custEmailA = `call_cust_a_${timestamp}@smarteats.com`;
  const custEmailB = `call_cust_b_${timestamp}@smarteats.com`;
  const driverEmailA = `call_driver_a_${timestamp}@smarteats.com`;

  // Register Customer A with Phone
  const tokenCustA = await registerAndLogin(custEmailA, 'CUSTOMER', {
    phone: '9876543210',
    deliveryAddress: '100ft Road, Indiranagar',
    customerLatitude: 12.9784,
    customerLongitude: 77.6408
  });
  assert(!!tokenCustA, 'Customer A registered and authenticated');

  // Register Customer B for IDOR testing
  const tokenCustB = await registerAndLogin(custEmailB, 'CUSTOMER', {
    phone: '9123456780',
    deliveryAddress: 'Koramangala 5th Block',
    customerLatitude: 12.9352,
    customerLongitude: 77.6245
  });
  assert(!!tokenCustB, 'Customer B registered for IDOR isolation check');

  // Register Driver A with distinct Phone
  const driverPhone = '+91 97777 55555';
  const tokenDriverA = await registerAndLogin(driverEmailA, 'DELIVERY_PARTNER', {
    phone: driverPhone,
    vehicleType: 'MOTORCYCLE',
    vehicleNumber: 'KA-01-CALL-7777',
    drivingLicenseNumber: 'DL-KA01-7777777',
    driverBaseAddress: 'Indiranagar Hub',
    driverCity: 'Bengaluru',
    driverState: 'Karnataka',
    driverPincode: '560038',
    driverBaseLatitude: 12.9784,
    driverBaseLongitude: 77.6408
  });
  assert(!!tokenDriverA, `Driver A registered with phone (${driverPhone})`);

  // Set Driver A ONLINE
  await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/deliveries/partner/availability?active=true&available=true',
    method: 'PUT',
    headers: { Authorization: `Bearer ${tokenDriverA}` }
  });

  // Authenticate Restaurant Owner & get restaurant details
  const tokenRest = await registerAndLogin('restaurant@smarteats.com', 'RESTAURANT_OWNER');
  const restProfileRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/restaurants/my-restaurants',
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenRest}` }
  });
  assert(restProfileRes.status === 200, 'Restaurant profile fetched');
  const restaurants = Array.isArray(restProfileRes.data) ? restProfileRes.data : [restProfileRes.data];
  assert(restaurants.length > 0, 'Restaurant list found');
  const restaurant = restaurants[0];
  console.log(`  Restaurant Name: ${restaurant.name}, Phone: ${restaurant.phone}`);
  assert(restaurant.phone != null, 'Restaurant has phone number populated in MongoDB');
  const expectedRestTelUri = cleanTelUri(restaurant.phone);
  assert(expectedRestTelUri.startsWith('tel:+91'), `Restaurant tel link generated correctly: ${expectedRestTelUri}`);

  // Customer places order
  await request(
    {
      hostname: 'localhost',
      port: 8080,
      path: '/api/orders/cart?restaurantId=' + restaurant.id,
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenCustA}`, 'Content-Type': 'application/json' }
    },
    { menuItemId: 'item_501', itemId: 'item_501', quantity: 1, price: 349, name: 'Margherita Special' }
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
  assert(orderRes.status === 200 || orderRes.status === 201, 'Customer placed COD order');
  const orderId = orderRes.body?.data?.id || orderRes.body?.id;

  // Restaurant accepts order
  await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/orders/my/orders/${orderId}/accept`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenRest}` }
  });

  // Wait for delivery assignment to trigger and propagate
  let delivery = null;
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 400));
    const deliveryRes = await request({
      hostname: 'localhost',
      port: 8080,
      path: `/api/deliveries/order/${orderId}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenCustA}` }
    });
    if (deliveryRes.status === 200 && deliveryRes.body?.data) {
      delivery = deliveryRes.body.data;
      break;
    }
  }
  assert(delivery != null, 'Customer A retrieved delivery tracking record');
  console.log(`  Assigned Rider: ${delivery.deliveryPartnerEmail}, Driver Phone: ${delivery.driverPhone}`);

  assert(delivery.driverPhone != null, 'Driver phone is populated in DeliveryResponse upon driver assignment');
  const expectedDriverTelUri = cleanTelUri(delivery.driverPhone);
  assert(expectedDriverTelUri.startsWith('tel:+91'), `Driver tel link generated correctly: ${expectedDriverTelUri}`);
  assert(formatIndianPhone(delivery.driverPhone).startsWith('+91 '), 'Driver phone formatted nicely for customer display');

  // Security Test: Customer B attempts to access Customer A's delivery & driver contact info
  const idorRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/deliveries/order/${orderId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenCustB}` }
  });
  assert(idorRes.status === 403, 'Cross-Customer IDOR prevented: Customer B receives HTTP 403 Forbidden attempting to view Driver contact info');

  // Unauthenticated access check
  const unauthRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/deliveries/order/${orderId}`,
    method: 'GET'
  });
  assert(unauthRes.status === 401, 'Unauthenticated user receives HTTP 401');

  console.log('\n========================================================================');
  console.log(`🏆 STEP 8.4A TEST SUITE: ${passedChecks}/${totalChecks} CHECKS PASSED (100%)`);
  console.log('========================================================================\n');
}

runStep84aVerification().catch(err => {
  console.error('\n❌ STEP 8.4A TEST FAILED:', err);
  process.exit(1);
});
