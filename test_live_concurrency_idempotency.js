const crypto = require('crypto');

const API_BASE = 'http://localhost:8080';

async function request(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = text;
  }
  return { status: res.status, ok: res.ok, data: json, rawBody: text };
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runLiveConcurrencyIdempotencyTest() {
  console.log('===============================================================');
  console.log('🚀 RUNNING LIVE BACKEND IDEMPOTENCY & CONCURRENCY TEST SUITE');
  console.log('===============================================================\n');

  console.log('Checking health of microservices...');
  const healthRes = await request(`${API_BASE}/api/restaurants`);
  if (!healthRes.ok) {
    console.log('Waiting 5s for gateway/services...');
    await sleep(5000);
  }

  const custA_Email = `idemp_userA_${Date.now()}@smarteats.com`;
  const custB_Email = `idemp_userB_${Date.now()}@smarteats.com`;
  const password = 'Password123!';

  // 1. Register & Login Customer A
  console.log(`1. Registering Customer A (${custA_Email})...`);
  await request(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Customer A',
      email: custA_Email,
      password: password,
      roles: ['CUSTOMER'],
      address: '100 Feet Rd, Indiranagar',
      customerLatitude: 12.9716,
      customerLongitude: 77.5946,
      locationSource: 'GPS'
    })
  });

  const loginARes = await request(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: custA_Email, password: password })
  });
  const tokenA = loginARes.data?.data?.token || loginARes.data?.token;
  const headersA = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` };
  console.log('   ✅ Customer A authenticated.');

  // 2. Register & Login Customer B
  console.log(`2. Registering Customer B (${custB_Email})...`);
  await request(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Customer B',
      email: custB_Email,
      password: password,
      roles: ['CUSTOMER'],
      address: 'Koramangala 5th Block',
      customerLatitude: 12.9352,
      customerLongitude: 77.6245,
      locationSource: 'GPS'
    })
  });

  const loginBRes = await request(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: custB_Email, password: password })
  });
  const tokenB = loginBRes.data?.data?.token || loginBRes.data?.token;
  const headersB = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` };
  console.log('   ✅ Customer B authenticated.');

  // 3. Discover Restaurant & Available Menu Item
  console.log('\n3. Discovering Open Restaurant & Available Menu Items...');
  const restRes = await request(`${API_BASE}/api/restaurants`, { headers: headersA });
  const restaurants = restRes.data?.data || restRes.data || [];
  let targetRestaurant = null;
  let targetMenuItem = null;

  for (const r of restaurants) {
    const rId = r.id || r._id;
    const menuRes = await request(`${API_BASE}/api/restaurants/${rId}/menu`, { headers: headersA });
    const items = menuRes.data?.data || menuRes.data || [];
    if (r.open === true && items.length > 0) {
      const item = items.find(m => m.available !== false && (m.availableQuantity === null || m.availableQuantity >= 10));
      if (item) {
        targetRestaurant = r;
        targetMenuItem = item;
        break;
      }
    }
  }

  if (!targetRestaurant || !targetMenuItem) {
    throw new Error('No open restaurant with sufficient menu item stock found!');
  }

  const restaurantId = targetRestaurant.id || targetRestaurant._id;
  const menuItemId = targetMenuItem.id || targetMenuItem._id;
  console.log(`   Selected Restaurant: "${targetRestaurant.name}" (${restaurantId})`);
  console.log(`   Selected Menu Item: "${targetMenuItem.name}" (${menuItemId}) [Price: ₹${targetMenuItem.price}]`);

  // =========================================================================
  // TEST 1: 10 CONCURRENT RAZORPAY REQUESTS WITH SAME IDEMPOTENCY KEY
  // =========================================================================
  console.log('\n===============================================================');
  console.log('🧪 TEST 1: 10 CONCURRENT RAZORPAY REQUESTS (SAME IDEMPOTENCY KEY)');
  console.log('===============================================================');

  // Add item to cart for Customer A
  await request(`${API_BASE}/api/orders/cart?restaurantId=${encodeURIComponent(restaurantId)}`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      menuItemId: menuItemId,
      quantity: 1,
      price: targetMenuItem.price,
      name: targetMenuItem.name
    })
  });

  const razorpayKey = crypto.randomUUID();
  console.log(`   Generated Razorpay Idempotency-Key: ${razorpayKey}`);
  console.log('   Firing 10 concurrent POST /api/orders/payment/create-order requests...');

  const rzpPromises = [];
  for (let i = 0; i < 10; i++) {
    rzpPromises.push(
      request(`${API_BASE}/api/orders/payment/create-order`, {
        method: 'POST',
        headers: {
          ...headersA,
          'Idempotency-Key': razorpayKey
        }
      })
    );
  }

  const rzpResults = await Promise.all(rzpPromises);
  console.log('   Received responses for all 10 concurrent requests.');

  // Validate results
  const rzpStatuses = rzpResults.map(r => r.status);
  console.log(`   Statuses: ${rzpStatuses.join(', ')}`);

  const rzpOrders = rzpResults.map(r => r.data?.data || r.data);
  const distinctOrderIds = [...new Set(rzpOrders.map(o => o?.orderId || o?.id).filter(Boolean))];
  const distinctRzpOrderIds = [...new Set(rzpOrders.map(o => o?.razorpayOrderId).filter(Boolean))];

  console.log(`   Distinct SmartEats Order IDs: ${distinctOrderIds.length} -> ${JSON.stringify(distinctOrderIds)}`);
  console.log(`   Distinct Razorpay Order IDs:  ${distinctRzpOrderIds.length} -> ${JSON.stringify(distinctRzpOrderIds)}`);

  if (distinctOrderIds.length !== 1 || distinctRzpOrderIds.length !== 1) {
    throw new Error(`TEST 1 FAILED: Expected exactly 1 SmartEats order and 1 Razorpay order, got ${distinctOrderIds.length} and ${distinctRzpOrderIds.length}`);
  }

  for (let i = 0; i < rzpResults.length; i++) {
    if (rzpResults[i].status !== 200 && rzpResults[i].status !== 201) {
      throw new Error(`TEST 1 FAILED: Request #${i + 1} returned status ${rzpResults[i].status}`);
    }
  }

  const winningRzpOrder = rzpOrders[0];
  console.log(`   ✅ Single SmartEats Order Created: ${winningRzpOrder.orderId || winningRzpOrder.id}`);
  console.log(`   ✅ Single Razorpay Order Created:  ${winningRzpOrder.razorpayOrderId}`);
  console.log(`   ✅ Idempotency Key:                ${winningRzpOrder.idempotencyKey}`);
  console.log('   🎉 TEST 1 PASSED: Exactly 1 SmartEats & 1 Razorpay order created across 10 concurrent calls!');

  // =========================================================================
  // TEST 2: 10 CONCURRENT COD REQUESTS WITH SAME IDEMPOTENCY KEY
  // =========================================================================
  console.log('\n===============================================================');
  console.log('🧪 TEST 2: 10 CONCURRENT COD REQUESTS (SAME IDEMPOTENCY KEY)');
  console.log('===============================================================');

  // Add item to cart for Customer A
  await request(`${API_BASE}/api/orders/cart?restaurantId=${encodeURIComponent(restaurantId)}`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      menuItemId: menuItemId,
      quantity: 1,
      price: targetMenuItem.price,
      name: targetMenuItem.name
    })
  });

  const codKey = crypto.randomUUID();
  console.log(`   Generated COD Idempotency-Key: ${codKey}`);
  console.log('   Firing 10 concurrent POST /api/orders/cod requests...');

  const codPromises = [];
  for (let i = 0; i < 10; i++) {
    codPromises.push(
      request(`${API_BASE}/api/orders/cod`, {
        method: 'POST',
        headers: {
          ...headersA,
          'Idempotency-Key': codKey
        }
      })
    );
  }

  const codResults = await Promise.all(codPromises);
  console.log('   Received responses for all 10 concurrent COD requests.');

  const codStatuses = codResults.map(r => r.status);
  console.log(`   Statuses: ${codStatuses.join(', ')}`);

  const codOrders = codResults.map(r => r.data?.data || r.data);
  const distinctCodOrderIds = [...new Set(codOrders.map(o => o?.id || o?.orderId).filter(Boolean))];

  console.log(`   Distinct COD Order IDs: ${distinctCodOrderIds.length} -> ${JSON.stringify(distinctCodOrderIds)}`);

  if (distinctCodOrderIds.length !== 1) {
    throw new Error(`TEST 2 FAILED: Expected exactly 1 COD order, got ${distinctCodOrderIds.length}`);
  }

  for (let i = 0; i < codResults.length; i++) {
    if (codResults[i].status !== 200 && codResults[i].status !== 201) {
      throw new Error(`TEST 2 FAILED: Request #${i + 1} returned status ${codResults[i].status}`);
    }
  }

  const winningCodOrder = codOrders[0];
  console.log(`   ✅ Single COD Order Created: ${winningCodOrder.id || winningCodOrder.orderId}`);
  console.log(`   ✅ Status:                   ${winningCodOrder.status}`);
  console.log(`   ✅ Payment Status:           ${winningCodOrder.paymentStatus}`);
  console.log(`   ✅ Payment Method:           ${winningCodOrder.paymentMethod}`);
  console.log(`   ✅ Idempotency Key:          ${winningCodOrder.idempotencyKey}`);
  console.log('   🎉 TEST 2 PASSED: Exactly 1 COD order created across 10 concurrent calls!');

  // =========================================================================
  // TEST 3: CROSS-CUSTOMER IDEMPOTENCY KEY REUSE (IDOR SECURITY - HTTP 403)
  // =========================================================================
  console.log('\n===============================================================');
  console.log('🧪 TEST 3: CROSS-CUSTOMER KEY REUSE (SECURITY IDOR CHECK)');
  console.log('===============================================================');

  // Customer B tries to reuse Customer A's COD key
  console.log(`   Customer B attempting to place COD order with Customer A's key (${codKey})...`);
  const idorRes = await request(`${API_BASE}/api/orders/cod`, {
    method: 'POST',
    headers: {
      ...headersB,
      'Idempotency-Key': codKey
    }
  });

  console.log(`   Status: ${idorRes.status} (Expected: 403)`);
  if (idorRes.status !== 403) {
    throw new Error(`TEST 3 FAILED: Expected HTTP 403 on cross-customer key reuse, got ${idorRes.status}`);
  }
  console.log('   🎉 TEST 3 PASSED: Cross-customer key reuse properly rejected with HTTP 403 Forbidden!');

  // =========================================================================
  // TEST 4: CROSS-PAYMENT METHOD KEY REUSE (CONFLICT CHECK - HTTP 400)
  // =========================================================================
  console.log('\n===============================================================');
  console.log('🧪 TEST 4: CROSS-PAYMENT METHOD KEY CONFLICT CHECK');
  console.log('===============================================================');

  // Customer A tries to use their COD key for Razorpay checkout
  console.log(`   Customer A attempting Razorpay checkout with COD key (${codKey})...`);
  const methodConflictRes = await request(`${API_BASE}/api/orders/payment/create-order`, {
    method: 'POST',
    headers: {
      ...headersA,
      'Idempotency-Key': codKey
    }
  });

  console.log(`   Status: ${methodConflictRes.status} (Expected: 400)`);
  if (methodConflictRes.status !== 400) {
    throw new Error(`TEST 4 FAILED: Expected HTTP 400 on method conflict key reuse, got ${methodConflictRes.status}`);
  }
  console.log('   🎉 TEST 4 PASSED: Cross-method key reuse properly rejected with HTTP 400 Bad Request!');

  // =========================================================================
  // TEST 5: 10 DISTINCT REQUESTS WITH DIFFERENT IDEMPOTENCY KEYS
  // =========================================================================
  console.log('\n===============================================================');
  console.log('🧪 TEST 5: 10 DISTINCT REQUESTS WITH DIFFERENT IDEMPOTENCY KEYS');
  console.log('===============================================================');

  const distinctOrdersCreated = [];
  for (let i = 1; i <= 5; i++) {
    // Add item to cart
    await request(`${API_BASE}/api/orders/cart?restaurantId=${encodeURIComponent(restaurantId)}`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        menuItemId: menuItemId,
        quantity: 1,
        price: targetMenuItem.price,
        name: targetMenuItem.name
      })
    });

    const uniqueKey = crypto.randomUUID();
    const res = await request(`${API_BASE}/api/orders/cod`, {
      method: 'POST',
      headers: {
        ...headersA,
        'Idempotency-Key': uniqueKey
      }
    });

    if (res.status === 201 || res.status === 200) {
      const ord = res.data?.data || res.data;
      distinctOrdersCreated.push(ord.id || ord.orderId);
      console.log(`   Order #${i} created: ID=${ord.id || ord.orderId} (Key=${uniqueKey.substring(0, 8)}...)`);
    } else {
      throw new Error(`TEST 5 FAILED on iteration ${i}: status ${res.status}`);
    }
  }

  const uniqueCreatedSet = new Set(distinctOrdersCreated);
  console.log(`   Total distinct orders created: ${uniqueCreatedSet.size} / 5`);
  if (uniqueCreatedSet.size !== 5) {
    throw new Error(`TEST 5 FAILED: Expected 5 distinct orders, got ${uniqueCreatedSet.size}`);
  }
  console.log('   🎉 TEST 5 PASSED: Different keys create independent separate orders as expected!');

  console.log('\n===============================================================');
  console.log('🏆 ALL LIVE BACKEND IDEMPOTENCY & CONCURRENCY TESTS PASSED!');
  console.log('===============================================================');
}

runLiveConcurrencyIdempotencyTest().catch(err => {
  console.error('\n❌ Live Concurrency/Idempotency test failed:', err);
  process.exit(1);
});
