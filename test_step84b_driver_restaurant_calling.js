/**
 * SMART EATS — STEP 8.4B DRIVER <-> RESTAURANT CONTACT & CALLING VALIDATION SUITE
 * 
 * Verifies:
 * 1. Delivery Partner -> Restaurant contact & calling
 * 2. Restaurant Owner -> Assigned Delivery Partner contact & calling
 * 3. Strict microservice ownership & Cross-Tenant IDOR isolation
 * 4. Front-end phone normalization and graceful fallbacks
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

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

let checksPassed = 0;
let checksFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    checksPassed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    checksFailed++;
  }
}

async function runStep84BTestSuite() {
  console.log('========================================================================');
  console.log('SMART EATS — STEP 8.4B DRIVER <-> RESTAURANT CALLING TEST SUITE');
  console.log('========================================================================\n');

  // --- SECTION 1: Static Code Audit on Frontend Components ---
  console.log('--- SECTION 1: Static Code Audit on Frontend Components ---');
  const driverPortalSrc = fs.readFileSync(path.join(__dirname, 'frontend/src/components/DriverPortal.jsx'), 'utf8');
  assert(driverPortalSrc.includes('cleanTelUri(delivery.restaurantPhone)'), 'DriverPortal checks cleanTelUri before rendering Call Restaurant link');
  assert(driverPortalSrc.includes('📞 Call Restaurant'), 'DriverPortal includes accessible 📞 Call Restaurant button');
  assert(driverPortalSrc.includes('Restaurant phone not available'), 'DriverPortal handles missing restaurant phone gracefully');

  const restaurantDashboardSrc = fs.readFileSync(path.join(__dirname, 'frontend/src/components/RestaurantRdssDashboard.jsx'), 'utf8');
  assert(restaurantDashboardSrc.includes('cleanTelUri(delivery.driverPhone)'), 'RestaurantRdssDashboard checks cleanTelUri for assigned driver phone');
  assert(restaurantDashboardSrc.includes('📞 Call Driver'), 'RestaurantRdssDashboard includes accessible 📞 Call Driver button');
  assert(restaurantDashboardSrc.includes('Not assigned'), 'RestaurantRdssDashboard shows "Not assigned" when no driver is matched');
  assert(restaurantDashboardSrc.includes('Driver phone not available'), 'RestaurantRdssDashboard handles missing driver phone safely');

  // --- SECTION 2: Persona Setup and Authentication ---
  console.log('\n--- SECTION 2: Persona Setup and Authentication ---');
  const timestamp = Date.now();
  
  // Register Customer
  const custEmail = `call_cust_${timestamp}@smarteats.com`;
  const custToken = await registerAndLogin(custEmail, 'CUSTOMER', {
    deliveryAddress: 'Indiranagar 100ft Rd',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560038',
    customerLatitude: 12.9784,
    customerLongitude: 77.6408
  });
  assert(!!custToken, 'Customer registered and authenticated');

  // Register Restaurant Owner A (or authenticate existing seeded restaurant owner)
  const ownerAToken = await registerAndLogin('restaurant@smarteats.com', 'RESTAURANT_OWNER');
  assert(!!ownerAToken, 'Restaurant Owner A authenticated');

  // Register Restaurant Owner B (for cross-restaurant IDOR testing)
  const ownerBEmail = `owner_b_${timestamp}@smarteats.com`;
  const ownerBToken = await registerAndLogin(ownerBEmail, 'RESTAURANT_OWNER', {
    address: 'Whitefield Main Rd',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560066'
  });
  assert(!!ownerBToken, 'Restaurant Owner B registered for cross-tenant IDOR checks');

  // Register Driver A
  const driverAEmail = `driver_call_a_${timestamp}@smarteats.com`;
  const driverAToken = await registerAndLogin(driverAEmail, 'DELIVERY_PARTNER', {
    name: 'Rider Arjun',
    phone: '98888 77777',
    driverBaseAddress: 'Domlur Layout',
    driverCity: 'Bengaluru',
    driverState: 'Karnataka',
    driverPincode: '560071',
    driverBaseLatitude: 12.9698,
    driverBaseLongitude: 77.7500,
    vehicleType: 'SCOOTER',
    vehicleNumber: 'KA-01-AB-1234',
    drivingLicenseNumber: 'DL-99887766'
  });
  assert(!!driverAToken, 'Driver A registered with valid phone (+91 98888 77777)');

  // Await Kafka registration event propagation
  await new Promise(r => setTimeout(r, 600));

  // Set Driver A to ONLINE & AVAILABLE
  const driverAOnline = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/deliveries/partner/availability?active=true&available=true',
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${driverAToken}` }
  });
  assert(driverAOnline.status === 200, 'Driver A set to ONLINE & AVAILABLE');

  // Register Driver B (for cross-driver IDOR testing)
  const driverBEmail = `driver_call_b_${timestamp}@smarteats.com`;
  const driverBToken = await registerAndLogin(driverBEmail, 'DELIVERY_PARTNER', {
    name: 'Rider Bharat',
    phone: '97777 66666',
    driverBaseAddress: 'Indiranagar 12th Main',
    driverCity: 'Bengaluru',
    driverState: 'Karnataka',
    driverPincode: '560038',
    driverBaseLatitude: 12.9800,
    driverBaseLongitude: 77.7400,
    vehicleType: 'BIKE',
    vehicleNumber: 'KA-03-XY-9876',
    drivingLicenseNumber: 'DL-55443322'
  });
  assert(!!driverBToken, 'Driver B registered for security isolation testing');

  // --- SECTION 3: Retrieve Restaurant for Owner A ---
  console.log('\n--- SECTION 3: Restaurant Retrieval & Verification ---');
  const restProfileRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/restaurants/my-restaurants',
    method: 'GET',
    headers: { Authorization: `Bearer ${ownerAToken}` }
  });
  assert(restProfileRes.status === 200, 'Restaurant profile fetched');
  const restaurants = Array.isArray(restProfileRes.data) ? restProfileRes.data : [restProfileRes.data];
  assert(restaurants.length > 0, 'Restaurant list found');
  const restaurant = restaurants[0];
  const restaurantId = restaurant.id;
  console.log(`  Restaurant: ${restaurant.name} (ID: ${restaurantId}), Phone: ${restaurant.phone}`);
  assert(restaurant.phone != null, 'Restaurant has phone number populated in MongoDB');

  // --- SECTION 4: Order Creation & Delivery Assignment ---
  console.log('\n--- SECTION 4: Order Creation & Delivery Assignment ---');
  // Customer adds to cart
  await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/orders/cart?restaurantId=${restaurantId}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${custToken}`
    }
  }, {
    menuItemId: 'item_501',
    itemId: 'item_501',
    quantity: 1,
    price: 349.00,
    name: 'Margherita Special'
  });

  // Customer places COD order
  const orderRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/orders/cod',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${custToken}` }
  });
  const orderId = orderRes.body?.data?.id || orderRes.body?.id;
  assert((orderRes.status === 200 || orderRes.status === 201) && !!orderId, `COD Order placed with ID: ${orderId}`);

  // Restaurant Owner A accepts order
  const acceptRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/orders/my/orders/${orderId}/accept`,
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${ownerAToken}` }
  });
  assert(acceptRes.status === 200, 'Restaurant Owner A accepted the order');

  // Await delivery creation and auto-assignment
  let delivery = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    const delRes = await request({
      hostname: 'localhost',
      port: 8080,
      path: `/api/deliveries/order/${orderId}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${ownerAToken}` }
    });
    if (delRes.status === 200 && delRes.body?.data?.deliveryPartnerEmail) {
      delivery = delRes.body.data;
      break;
    }
  }

  assert(delivery !== null, 'Delivery record exists and matched to driver');
  assert(delivery?.deliveryPartnerEmail != null, `Delivery matched to driver (${delivery?.deliveryPartnerEmail})`);

  // --- SECTION 5: Driver -> Restaurant Contact & Calling (PART A) ---
  console.log('\n--- SECTION 5: Driver -> Restaurant Contact & Calling (PART A) ---');
  // Determine assigned and unassigned driver tokens
  let assignedDriverToken = null;
  if (delivery?.deliveryPartnerEmail === driverAEmail) {
    assignedDriverToken = driverAToken;
  } else if (delivery?.deliveryPartnerEmail === driverBEmail) {
    assignedDriverToken = driverBToken;
  } else if (delivery?.deliveryPartnerEmail) {
    const driverLoginRes = await request(
      { hostname: 'localhost', port: 8080, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { email: delivery.deliveryPartnerEmail, password: 'Password123!' }
    );
    assignedDriverToken = driverLoginRes.body?.data?.token || driverLoginRes.body?.token;
  }
  const unassignedDriverToken = delivery?.deliveryPartnerEmail === driverAEmail ? driverBToken : driverAToken;

  const driverDeliveriesRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/deliveries/my-deliveries',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${assignedDriverToken}` }
  });
  const driverDelivery = driverDeliveriesRes.body?.data?.find(d => d.orderId === orderId);
  
  assert(driverDelivery != null, 'Assigned driver can access assigned delivery');
  assert(driverDelivery?.restaurantName != null, `Driver sees restaurant name: "${driverDelivery?.restaurantName}"`);
  assert(driverDelivery?.restaurantPhone != null, `Driver sees restaurant phone: "${driverDelivery?.restaurantPhone}"`);
  
  const restTelUri = cleanTelUri(driverDelivery?.restaurantPhone);
  assert(restTelUri != null && restTelUri.startsWith('tel:+91'), `Restaurant tel link correctly generated: "${restTelUri}"`);

  // --- SECTION 6: Restaurant Owner -> Driver Contact & Calling (PART B) ---
  console.log('\n--- SECTION 6: Restaurant Owner -> Driver Contact & Calling (PART B) ---');
  // Restaurant Owner A fetches delivery for their order
  const restOwnerDeliveryRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/deliveries/order/${orderId}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${ownerAToken}` }
  });
  assert(restOwnerDeliveryRes.status === 200, 'Restaurant Owner A can fetch delivery for their restaurant order');
  
  const restOwnerDel = restOwnerDeliveryRes.body?.data;
  assert(restOwnerDel?.driverName != null, `Restaurant Owner sees driver name: "${restOwnerDel?.driverName}"`);
  assert(restOwnerDel?.driverPhone != null, `Restaurant Owner sees driver phone: "${restOwnerDel?.driverPhone}"`);
  
  const driverTelUri = cleanTelUri(restOwnerDel?.driverPhone);
  assert(driverTelUri != null && driverTelUri.startsWith('tel:+91'), `Driver tel link correctly generated: "${driverTelUri}"`);

  // --- SECTION 7: Security & IDOR Isolation Verification (PART F) ---
  console.log('\n--- SECTION 7: Security & IDOR Isolation Verification (PART F) ---');
  
  // 1. Non-assigned driver attempting to access the delivery
  const unassignedDriverAccess = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/deliveries/${delivery?.id}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${unassignedDriverToken}` }
  });
  assert(unassignedDriverAccess.status === 403, 'Cross-Driver IDOR: Unassigned driver receives HTTP 403 attempting to view delivery');

  // 2. Restaurant Owner B attempting to access Restaurant Owner A's delivery
  const ownerBUnauthorizedAccess = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/deliveries/order/${orderId}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${ownerBToken}` }
  });
  assert(ownerBUnauthorizedAccess.status === 403, 'Cross-Restaurant IDOR: Owner B receives HTTP 403 attempting to view Restaurant A delivery');

  // 3. Unauthenticated request rejected
  const unauthenticatedAccess = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/deliveries/order/${orderId}`,
    method: 'GET'
  });
  assert(unauthenticatedAccess.status === 401, 'Unauthenticated request receives HTTP 401');

  // 4. Customer attempting to access driver-specific endpoints rejected
  const customerDriverEndpointAccess = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/deliveries/my-deliveries',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${custToken}` }
  });
  assert(customerDriverEndpointAccess.status === 403, 'Customer role accessing driver-only endpoint receives HTTP 403');

  // --- SECTION 8: Calling Phone Normalization & Fallbacks ---
  console.log('\n--- SECTION 8: Phone Normalization & Fallback Verification ---');
  assert(cleanTelUri('+91 98450 12345') === 'tel:+919845012345', 'cleanTelUri normalizes spaced international number');
  assert(cleanTelUri('09845012345') === 'tel:+919845012345', 'cleanTelUri normalizes leading 0 number');
  assert(cleanTelUri(null) === null, 'cleanTelUri returns null for null phone');
  assert(cleanTelUri('') === null, 'cleanTelUri returns null for empty string');
  assert(cleanTelUri('malformed_text') === null, 'cleanTelUri returns null for malformed phone');
  assert(formatIndianPhone(null) === 'Phone not available', 'formatIndianPhone returns fallback for null');
  assert(formatIndianPhone('+919888877777') === '+91 98888 77777', 'formatIndianPhone formats Indian number cleanly');

  // Summary
  console.log('\n========================================================================');
  console.log(`🏆 STEP 8.4B TEST SUITE: ${checksPassed}/${checksPassed + checksFailed} CHECKS PASSED (${((checksPassed / (checksPassed + checksFailed)) * 100).toFixed(0)}%)`);
  console.log('========================================================================\n');

  if (checksFailed > 0) {
    process.exit(1);
  }
}

runStep84BTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
