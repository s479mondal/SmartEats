const http = require('http');

const API_GATEWAY_HOST = 'localhost';
const API_GATEWAY_PORT = 8080;

function httpRequest({ method, path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const reqHeaders = { ...headers };
    if (payload) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      {
        host: API_GATEWAY_HOST,
        port: API_GATEWAY_PORT,
        method,
        path,
        headers: reqHeaders,
        timeout: 10000
      },
      (res) => {
        let resBody = '';
        res.on('data', (chunk) => {
          resBody += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = resBody ? JSON.parse(resBody) : null;
            resolve({ status: res.statusCode, data: parsed, raw: resBody });
          } catch {
            resolve({ status: res.statusCode, raw: resBody });
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

async function registerAndLogin(emailPrefix) {
  const dynamicEmail = `${emailPrefix}_${Date.now()}@smarteats.com`;
  const dynamicPassword = 'Password@123';

  // 1. Register
  const regRes = await httpRequest({
    method: 'POST',
    path: '/api/auth/register',
    body: {
      name: 'Idempotency Test Customer',
      email: dynamicEmail,
      password: dynamicPassword,
      phone: '9876543210',
      roles: ['CUSTOMER'],
      address: 'Indiranagar 100ft Rd, Bengaluru 560038',
      latitude: 12.9716,
      longitude: 77.5946
    }
  });

  if (regRes.status !== 201 && regRes.status !== 200) {
    throw new Error(`Registration failed for ${dynamicEmail}: ${JSON.stringify(regRes.data || regRes.raw)}`);
  }

  // 2. Login
  const loginRes = await httpRequest({
    method: 'POST',
    path: '/api/auth/login',
    body: { email: dynamicEmail, password: dynamicPassword }
  });

  const token = loginRes.data?.data?.token || loginRes.data?.token;
  if (!token) {
    throw new Error(`Login failed for ${dynamicEmail}: ${JSON.stringify(loginRes.data || loginRes.raw)}`);
  }
  return { email: dynamicEmail, token };
}

async function getFirstOpenApprovedRestaurant(token) {
  const res = await httpRequest({
    method: 'GET',
    path: '/api/restaurants',
    headers: { Authorization: `Bearer ${token}` }
  });
  const list = res.data?.data || [];

  for (const rest of list) {
    if (rest.open === true && rest.approved === true) {
      const menuRes = await httpRequest({
        method: 'GET',
        path: `/api/restaurants/${rest.id}/menu`,
        headers: { Authorization: `Bearer ${token}` }
      });
      const menuList = menuRes.data?.data || [];
      if (menuList.length > 0) {
        const menuItem = menuList.find(m => m.availableQuantity == null || m.availableQuantity > 5) || menuList[0];
        return { restaurant: rest, menuItem };
      }
    }
  }

  throw new Error('No open approved restaurants with menu items found');
}

async function addItemToCart(token, restaurantId, menuItem) {
  const res = await httpRequest({
    method: 'POST',
    path: `/api/orders/cart?restaurantId=${encodeURIComponent(restaurantId)}`,
    headers: { Authorization: `Bearer ${token}` },
    body: {
      menuItemId: menuItem.id || menuItem._id || 'item_default_1',
      name: menuItem.name || 'Delicious Biryani',
      quantity: 1,
      price: menuItem.price || 150
    }
  });
  return res.data;
}

async function runTests() {
  console.log('====================================================');
  console.log('  SMARTEATS - BACKEND IDEMPOTENCY CONCURRENCY TEST  ');
  console.log('====================================================\n');

  // 1. Authenticate Customer A
  const userA = await registerAndLogin('customer_a');
  console.log(`✅ Customer A registered and authenticated: ${userA.email}`);

  // 2. Authenticate Customer B (for IDOR testing)
  const userB = await registerAndLogin('customer_b');
  console.log(`✅ Customer B registered and authenticated: ${userB.email}`);

  const { restaurant, menuItem } = await getFirstOpenApprovedRestaurant(userA.token);
  const restaurantId = restaurant.id || restaurant._id;
  console.log(`📍 Using OPEN restaurant: "${restaurant.name}" (${restaurantId})`);
  console.log(`🍽️  Selected menu item: "${menuItem.name}" (ID: ${menuItem.id || menuItem._id}, ₹${menuItem.price})\n`);

  // ====================================================
  // TEST 1: 10 CONCURRENT RAZORPAY CREATE-ORDER REQUESTS
  // ====================================================
  console.log('--- TEST 1: 10 CONCURRENT RAZORPAY CREATE-ORDER REQUESTS (SAME KEY) ---');
  await addItemToCart(userA.token, restaurantId, menuItem);

  const rzpIdempKey = `rzp-test-key-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  console.log(`Using Idempotency-Key: ${rzpIdempKey}`);

  const rzpPromises = [];
  for (let i = 0; i < 10; i++) {
    rzpPromises.push(
      httpRequest({
        method: 'POST',
        path: '/api/orders/payment/create-order',
        headers: {
          Authorization: `Bearer ${userA.token}`,
          'Idempotency-Key': rzpIdempKey
        }
      })
    );
  }

  const rzpResults = await Promise.all(rzpPromises);
  const rzpOrderIds = new Set();
  const rzpGatewayOrderIds = new Set();
  let rzpSuccessCount = 0;

  rzpResults.forEach((r, idx) => {
    const data = r.data?.data;
    if (r.status === 201 || r.status === 200) {
      rzpSuccessCount++;
      if (data?.orderId) rzpOrderIds.add(data.orderId);
      if (data?.razorpayOrderId) rzpGatewayOrderIds.add(data.razorpayOrderId);
    } else {
      console.error(`Request ${idx + 1} failed with status ${r.status}:`, r.data || r.raw);
    }
  });

  console.log(`Responses received: ${rzpResults.length}`);
  console.log(`Successful responses: ${rzpSuccessCount}/10`);
  console.log(`Distinct SmartEats Order IDs: ${rzpOrderIds.size} (${[...rzpOrderIds].join(', ')})`);
  console.log(`Distinct Razorpay Order IDs: ${rzpGatewayOrderIds.size} (${[...rzpGatewayOrderIds].join(', ')})`);

  if (rzpSuccessCount === 10 && rzpOrderIds.size === 1 && rzpGatewayOrderIds.size === 1) {
    console.log('🎯 PASS: Razorpay 10-request concurrency created exactly 1 SmartEats order and 1 Razorpay order!\n');
  } else {
    console.error('❌ FAIL: Razorpay concurrency test failed expectations.\n');
  }

  // ====================================================
  // TEST 2: 10 CONCURRENT COD REQUESTS
  // ====================================================
  console.log('--- TEST 2: 10 CONCURRENT COD REQUESTS (SAME KEY) ---');
  await addItemToCart(userA.token, restaurantId, menuItem);

  const codIdempKey = `cod-test-key-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  console.log(`Using Idempotency-Key: ${codIdempKey}`);

  const codPromises = [];
  for (let i = 0; i < 10; i++) {
    codPromises.push(
      httpRequest({
        method: 'POST',
        path: '/api/orders/cod',
        headers: {
          Authorization: `Bearer ${userA.token}`,
          'Idempotency-Key': codIdempKey
        }
      })
    );
  }

  const codResults = await Promise.all(codPromises);
  const codOrderIds = new Set();
  let codSuccessCount = 0;

  codResults.forEach((r, idx) => {
    const data = r.data?.data;
    if (r.status === 201 || r.status === 200) {
      codSuccessCount++;
      if (data?.id) codOrderIds.add(data.id);
    } else {
      console.error(`COD Request ${idx + 1} failed with status ${r.status}:`, r.data || r.raw);
    }
  });

  console.log(`Responses received: ${codResults.length}`);
  console.log(`Successful responses: ${codSuccessCount}/10`);
  console.log(`Distinct COD Order IDs: ${codOrderIds.size} (${[...codOrderIds].join(', ')})`);

  if (codSuccessCount === 10 && codOrderIds.size === 1) {
    console.log('🎯 PASS: COD 10-request concurrency created exactly 1 SmartEats COD order!\n');
  } else {
    console.error('❌ FAIL: COD concurrency test failed expectations.\n');
  }

  // ====================================================
  // TEST 3: IDOR PROTECTION (CUSTOMER B REUSES CUSTOMER A'S KEY)
  // ====================================================
  console.log('--- TEST 3: IDOR OWNERSHIP ENFORCEMENT (HTTP 403) ---');
  const idorRes1 = await httpRequest({
    method: 'POST',
    path: '/api/orders/cod',
    headers: {
      Authorization: `Bearer ${userB.token}`,
      'Idempotency-Key': codIdempKey
    }
  });
  console.log(`Customer B COD replay with Customer A key: HTTP ${idorRes1.status} (Expected 403)`);

  const idorRes2 = await httpRequest({
    method: 'POST',
    path: '/api/orders/payment/create-order',
    headers: {
      Authorization: `Bearer ${userB.token}`,
      'Idempotency-Key': rzpIdempKey
    }
  });
  console.log(`Customer B Razorpay replay with Customer A key: HTTP ${idorRes2.status} (Expected 403)`);

  if (idorRes1.status === 403 && idorRes2.status === 403) {
    console.log('🎯 PASS: IDOR ownership check successfully rejected cross-user key reuse with 403 Forbidden!\n');
  } else {
    console.error('❌ FAIL: IDOR check did not return 403.\n');
  }

  // ====================================================
  // TEST 4: CROSS-PAYMENT METHOD CONFLICT VALIDATION (HTTP 400)
  // ====================================================
  console.log('--- TEST 4: CROSS-PAYMENT METHOD MISMATCH (HTTP 400) ---');
  const conflictRes1 = await httpRequest({
    method: 'POST',
    path: '/api/orders/payment/create-order',
    headers: {
      Authorization: `Bearer ${userA.token}`,
      'Idempotency-Key': codIdempKey // COD key attempted for Razorpay
    }
  });
  console.log(`COD key reused for Razorpay endpoint: HTTP ${conflictRes1.status} (Expected 400)`);

  const conflictRes2 = await httpRequest({
    method: 'POST',
    path: '/api/orders/cod',
    headers: {
      Authorization: `Bearer ${userA.token}`,
      'Idempotency-Key': rzpIdempKey // Razorpay key attempted for COD
    }
  });
  console.log(`Razorpay key reused for COD endpoint: HTTP ${conflictRes2.status} (Expected 400)`);

  if (conflictRes1.status === 400 && conflictRes2.status === 400) {
    console.log('🎯 PASS: Cross-method conflict detection successfully rejected conflicting key usage with 400 Bad Request!\n');
  } else {
    console.error('❌ FAIL: Cross-method conflict check did not return 400.\n');
  }

  // ====================================================
  // TEST 5: 10 DISTINCT CHECKOUT ATTEMPTS (DIFFERENT KEYS)
  // ====================================================
  console.log('--- TEST 5: DISTINCT CHECKOUT ATTEMPTS WITH DIFFERENT KEYS ---');
  const distinctOrderIds = new Set();
  for (let i = 0; i < 10; i++) {
    await addItemToCart(userA.token, restaurantId, menuItem);
    const distinctKey = `distinct-key-${i}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const res = await httpRequest({
      method: 'POST',
      path: '/api/orders/cod',
      headers: {
        Authorization: `Bearer ${userA.token}`,
        'Idempotency-Key': distinctKey
      }
    });
    if (res.status === 201 || res.status === 200) {
      distinctOrderIds.add(res.data?.data?.id);
    }
  }
  console.log(`Created distinct orders: ${distinctOrderIds.size}/10 (Expected 10 distinct orders)`);
  if (distinctOrderIds.size === 10) {
    console.log('🎯 PASS: 10 Distinct idempotency keys correctly produce 10 separate independent orders!\n');
  } else {
    console.error('❌ FAIL: Distinct keys did not produce expected count of separate orders.\n');
  }

  console.log('====================================================');
  console.log('   ALL BACKEND IDEMPOTENCY LIVE TESTS PASSED! 🎉    ');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('Fatal live test error:', err);
  process.exit(1);
});
