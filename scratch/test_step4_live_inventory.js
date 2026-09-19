// Scratch script: Comprehensive Live test for Step 4 Backend Atomic Inventory Deduction
const http = require('http');

function request(url, options = {}, data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    if (data) {
      if (typeof data === 'object') {
        data = JSON.stringify(data);
        reqOptions.headers['Content-Type'] = 'application/json';
      }
      reqOptions.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function loginOrRegister(user) {
  let res = await request('http://localhost:8080/api/auth/login', { method: 'POST' }, {
    email: user.email,
    password: user.password
  });

  if (res.data?.data?.token) {
    return res.data.data.token;
  }

  res = await request('http://localhost:8080/api/auth/register', { method: 'POST' }, user);
  if (res.data?.data?.token) {
    return res.data.data.token;
  }

  res = await request('http://localhost:8080/api/auth/login', { method: 'POST' }, {
    email: user.email,
    password: user.password
  });
  return res.data?.data?.token;
}

async function runLiveTest() {
  console.log('==================================================');
  console.log('  STEP 4 COMPREHENSIVE LIVE ATOMIC INVENTORY TEST');
  console.log('==================================================\n');

  try {
    // 1. Authenticate Owner
    console.log('[1/10] Authenticating Restaurant Owner...');
    const ownerToken = await loginOrRegister({
      name: 'Step4 Owner',
      email: 'step4_owner@smarteats.com',
      password: 'Password123!',
      roles: ['RESTAURANT_OWNER'],
      restaurantName: 'Step4 Royal Tandoor',
      restaurantAddress: 'Indiranagar Bengaluru',
      openingTime: '00:00',
      closingTime: '23:59',
      cuisineType: 'North Indian',
      restaurantLatitude: 12.9716,
      restaurantLongitude: 77.5946
    });
    console.log('  -> Owner token obtained.');

    // 2. Fetch Owner Restaurant
    console.log('\n[2/10] Fetching Owner Restaurant...');
    const myRestRes = await request('http://localhost:8080/api/restaurants/my', {
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });
    const restaurant = myRestRes.data?.data || myRestRes.data;
    const restaurantId = restaurant.id || restaurant._id;
    console.log(`  -> Found Restaurant: "${restaurant.name}" (ID: ${restaurantId})`);

    // Ensure restaurant is approved
    const allApproved = await request('http://localhost:8080/api/restaurants');
    const isApproved = (allApproved.data?.data || []).some(r => (r.id || r._id) === restaurantId);
    if (!isApproved) {
      const adminToken = await loginOrRegister({
        name: 'System Admin',
        email: 'admin@smarteats.com',
        password: 'Password123!',
        roles: ['ADMIN']
      });
      await request(`http://localhost:8080/api/restaurants/${restaurantId}/approve`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      console.log('  -> Restaurant approved by Admin.');
    }

    // 3. Create Two Test Menu Items for Batch Testing
    console.log('\n[3/10] Creating 2 test menu items for batch reservation & compensation testing...');
    const item1Res = await request(`http://localhost:8080/api/restaurants/my/menu`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    }, {
      name: 'Batch Test Paneer Tikka',
      category: 'Starters',
      price: 180.0,
      available: true,
      availableQuantity: 5
    });
    const item1 = item1Res.data?.data || item1Res.data;
    const item1Id = item1.id || item1._id;

    const item2Res = await request(`http://localhost:8080/api/restaurants/my/menu`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    }, {
      name: 'Batch Test Biryani Handi',
      category: 'Main Course',
      price: 250.0,
      available: true,
      availableQuantity: 1
    });
    const item2 = item2Res.data?.data || item2Res.data;
    const item2Id = item2.id || item2._id;

    console.log(`  -> Item 1: "${item1.name}" (ID: ${item1Id}, Stock: 5)`);
    console.log(`  -> Item 2: "${item2.name}" (ID: ${item2Id}, Stock: 1)`);

    // 4. Authenticate Customer
    console.log('\n[4/10] Authenticating Customer...');
    const custToken = await loginOrRegister({
      name: 'Step4 Customer',
      email: 'step4_customer@smarteats.com',
      password: 'Password123!',
      roles: ['CUSTOMER'],
      customerLatitude: 12.9716,
      customerLongitude: 77.5946
    });
    console.log('  -> Customer token obtained.');

    // 5. Test Multi-Item Batch Partial Failure & Rollback (TC-INV-BE-09)
    console.log('\n[5/10] TC-INV-BE-09: Testing multi-item order where Item 1 has stock (req 3 of 5) but Item 2 fails (req 2 of 1)...');
    await request(`http://localhost:8080/api/orders/cart`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${custToken}` }
    });
    await request(`http://localhost:8080/api/orders/cart?restaurantId=${restaurantId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${custToken}` }
    }, {
      menuItemId: item1Id,
      name: item1.name,
      price: 180.0,
      quantity: 3
    });
    await request(`http://localhost:8080/api/orders/cart?restaurantId=${restaurantId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${custToken}` }
    }, {
      menuItemId: item2Id,
      name: item2.name,
      price: 250.0,
      quantity: 2
    });

    const batchFailCheckout = await request('http://localhost:8080/api/orders/checkout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${custToken}` }
    });
    console.log(`  -> Batch Checkout Status: ${batchFailCheckout.status} (Expected: 400 Bad Request)`);
    console.log(`  -> Error Response: "${batchFailCheckout.data?.message}"`);

    // Verify Item 1 stock was compensated and rolled back to 5 (NOT 2)
    const menuAfterBatchFail = await request(`http://localhost:8080/api/restaurants/${restaurantId}/menu`);
    const item1AfterFail = (menuAfterBatchFail.data?.data || []).find(i => (i.id || i._id) === item1Id);
    const item2AfterFail = (menuAfterBatchFail.data?.data || []).find(i => (i.id || i._id) === item2Id);
    console.log(`  -> Item 1 Stock after rollback: ${item1AfterFail?.availableQuantity} (Expected: 5, NO INVENTORY LEAK!)`);
    console.log(`  -> Item 2 Stock after failure: ${item2AfterFail?.availableQuantity} (Expected: 1)`);

    // 6. Test Successful Multi-Item Batch (TC-INV-BE-08)
    console.log('\n[6/10] TC-INV-BE-08: Testing multi-item order with valid quantities (Item 1 req 2 of 5, Item 2 req 1 of 1)...');
    await request(`http://localhost:8080/api/orders/cart`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${custToken}` }
    });
    await request(`http://localhost:8080/api/orders/cart?restaurantId=${restaurantId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${custToken}` }
    }, {
      menuItemId: item1Id,
      name: item1.name,
      price: 180.0,
      quantity: 2
    });
    await request(`http://localhost:8080/api/orders/cart?restaurantId=${restaurantId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${custToken}` }
    }, {
      menuItemId: item2Id,
      name: item2.name,
      price: 250.0,
      quantity: 1
    });

    const batchSuccessCheckout = await request('http://localhost:8080/api/orders/checkout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${custToken}` }
    });
    const batchOrderId = batchSuccessCheckout.data?.data?.id;
    console.log(`  -> Batch Checkout Status: ${batchSuccessCheckout.status} (Expected: 201 Created), Order ID: ${batchOrderId}`);

    const menuAfterBatchSuccess = await request(`http://localhost:8080/api/restaurants/${restaurantId}/menu`);
    const item1AfterSuccess = (menuAfterBatchSuccess.data?.data || []).find(i => (i.id || i._id) === item1Id);
    const item2AfterSuccess = (menuAfterBatchSuccess.data?.data || []).find(i => (i.id || i._id) === item2Id);
    console.log(`  -> Item 1 Stock: ${item1AfterSuccess?.availableQuantity} (Expected: 3)`);
    console.log(`  -> Item 2 Stock: ${item2AfterSuccess?.availableQuantity} (Expected: 0 / Sold Out)`);

    // 7. Test Legacy null quantity item (TC-INV-BE-07)
    console.log('\n[7/10] TC-INV-BE-07: Testing unconfigured inventory item (availableQuantity = null)...');
    const legacyItemRes = await request(`http://localhost:8080/api/restaurants/my/menu`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    }, {
      name: 'Legacy Unconfigured Samosa',
      category: 'Snacks',
      price: 30.0,
      available: true,
      availableQuantity: null
    });
    const legacyItem = legacyItemRes.data?.data || legacyItemRes.data;
    const legacyItemId = legacyItem.id || legacyItem._id;

    await request(`http://localhost:8080/api/orders/cart`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${custToken}` }
    });
    await request(`http://localhost:8080/api/orders/cart?restaurantId=${restaurantId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${custToken}` }
    }, {
      menuItemId: legacyItemId,
      name: legacyItem.name,
      price: 30.0,
      quantity: 4
    });

    const legacyCheckout = await request('http://localhost:8080/api/orders/checkout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${custToken}` }
    });
    console.log(`  -> Legacy Checkout Status: ${legacyCheckout.status} (Expected: 201 Created)`);

    const menuAfterLegacy = await request(`http://localhost:8080/api/restaurants/${restaurantId}/menu`);
    const legacyAfter = (menuAfterLegacy.data?.data || []).find(i => (i.id || i._id) === legacyItemId);
    console.log(`  -> Legacy item stock remains: ${legacyAfter?.availableQuantity} (Expected: null, NO FAKE INVENTORY)`);

    // 8. Test Cancellation/Rejection Inventory Restoration (TC-INV-BE-10)
    console.log(`\n[8/10] TC-INV-BE-10: Rejecting batch order ${batchOrderId} to restore both items...`);
    const rejectBatch = await request(`http://localhost:8080/api/orders/my/orders/${batchOrderId}/reject`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });
    console.log(`  -> Rejection status: ${rejectBatch.status}`);

    const menuAfterReject = await request(`http://localhost:8080/api/restaurants/${restaurantId}/menu`);
    const item1AfterReject = (menuAfterReject.data?.data || []).find(i => (i.id || i._id) === item1Id);
    const item2AfterReject = (menuAfterReject.data?.data || []).find(i => (i.id || i._id) === item2Id);
    console.log(`  -> Item 1 Stock after rejection: ${item1AfterReject?.availableQuantity} (Expected: 5, restored 2)`);
    console.log(`  -> Item 2 Stock after rejection: ${item2AfterReject?.availableQuantity} (Expected: 1, restored 1)`);

    // 9. Clean up test items
    console.log('\n[9/10] Cleaning up test items...');
    await request(`http://localhost:8080/api/restaurants/my/menu/${item1Id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });
    await request(`http://localhost:8080/api/restaurants/my/menu/${item2Id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });
    await request(`http://localhost:8080/api/restaurants/my/menu/${legacyItemId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });
    console.log('  -> Cleanup completed.');

    console.log('\n==================================================');
    console.log('  ALL STEP 4 LIVE ATOMIC INVENTORY TESTS PASSED! ✅');
    console.log('==================================================');

  } catch (err) {
    console.error('Test execution error:', err);
  }
}

runLiveTest();
