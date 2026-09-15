const http = require('http');

const GATEWAY = 'http://localhost:8080';

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(options.url || (GATEWAY + options.path));
    const reqOptions = {
      method: options.method || 'GET',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: options.headers || {}
    };

    if (data) {
      reqOptions.headers['Content-Type'] = 'application/json';
      if (!reqOptions.headers['Content-Length']) {
        reqOptions.headers['Content-Length'] = Buffer.byteLength(typeof data === 'string' ? data : JSON.stringify(data));
      }
    }

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch (e) { parsed = body; }
        resolve({ status: res.statusCode, headers: res.headers, data: parsed });
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function login(email, password) {
  const res = await request({
    method: 'POST',
    path: '/api/auth/login',
    headers: { 'Content-Type': 'application/json' }
  }, { email, password });

  if (res.status === 200 && res.data?.data?.token) {
    return res.data.data.token;
  }
  throw new Error(`Login failed for ${email}: status ${res.status} - ${JSON.stringify(res.data)}`);
}

async function ensureCustomerB() {
  const email = 'customer2@smarteats.com';
  const password = 'admin123';
  try {
    const token = await login(email, password);
    return token;
  } catch (e) {
    // Attempt registration if customer2 does not exist yet
    const regRes = await request({
      method: 'POST',
      path: '/api/auth/register',
      headers: { 'Content-Type': 'application/json' }
    }, {
      name: 'Customer Two',
      email: email,
      password: password,
      phone: '+91 9123456780',
      address: 'Indiranagar, Bangalore',
      roles: ['CUSTOMER']
    });
    console.log(`Registered customer2: status ${regRes.status}`);
    return await login(email, password);
  }
}

async function runSecurityTests() {
  console.log('====================================================');
  console.log('   STEP 8 — LIVE SECURITY AUDIT & HARDENING TESTS   ');
  console.log('====================================================\n');

  const results = [];

  function record(testName, expected, actual, passed, details = '') {
    results.push({ testName, expected, actual, status: passed ? 'PASS' : 'FAIL', details });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${testName} | Expected: ${expected} | Actual: ${actual} ${details ? '(' + details + ')' : ''}`);
  }

  // 1. Authenticate users of each role
  console.log('--- Phase 1: Authentication & Token Acquisition ---');
  let customerAToken, customerBToken, restaurantToken, driverToken, ngoToken, adminToken;
  try {
    customerAToken = await login('customer@smarteats.com', 'admin123');
    console.log('✓ Customer A (customer@smarteats.com) authenticated');

    customerBToken = await ensureCustomerB();
    console.log('✓ Customer B (customer2@smarteats.com) authenticated');

    restaurantToken = await login('restaurant@smarteats.com', 'admin123');
    console.log('✓ Restaurant Owner authenticated');

    driverToken = await login('driver@smarteats.com', 'admin123');
    console.log('✓ Driver authenticated');

    ngoToken = await login('ngo@smarteats.com', 'admin123');
    console.log('✓ NGO authenticated');

    adminToken = await login('admin@smarteats.com', 'admin123');
    console.log('✓ ADMIN authenticated');
  } catch (err) {
    console.error('Authentication error:', err.message);
    process.exit(1);
  }

  // 2. PART 1: Admin RBAC Test Matrix
  console.log('\n--- Phase 2: Admin API RBAC Matrix ---');

  // Test 2.1: No JWT -> 401
  let res = await request({ method: 'GET', path: '/api/admin/approvals/pending' });
  record('Unauthenticated Admin API (/approvals/pending)', 401, res.status, res.status === 401);

  // Test 2.2: Customer -> 403
  res = await request({
    method: 'GET',
    path: '/api/admin/approvals/pending',
    headers: { 'Authorization': `Bearer ${customerAToken}` }
  });
  record('Customer Admin API (/approvals/pending)', 403, res.status, res.status === 403);

  // Test 2.3: Restaurant Owner -> 403
  res = await request({
    method: 'GET',
    path: '/api/admin/approvals/pending',
    headers: { 'Authorization': `Bearer ${restaurantToken}` }
  });
  record('Restaurant Admin API (/approvals/pending)', 403, res.status, res.status === 403);

  // Test 2.4: Driver -> 403
  res = await request({
    method: 'GET',
    path: '/api/admin/approvals/pending',
    headers: { 'Authorization': `Bearer ${driverToken}` }
  });
  record('Driver Admin API (/approvals/pending)', 403, res.status, res.status === 403);

  // Test 2.5: NGO -> 403
  res = await request({
    method: 'GET',
    path: '/api/admin/approvals/pending',
    headers: { 'Authorization': `Bearer ${ngoToken}` }
  });
  record('NGO Admin API (/approvals/pending)', 403, res.status, res.status === 403);

  // Test 2.6: ADMIN -> 200
  res = await request({
    method: 'GET',
    path: '/api/admin/approvals/pending',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  record('Admin Admin API (/approvals/pending)', 200, res.status, res.status === 200);

  // Test other admin endpoints
  console.log('\n--- Phase 3: Additional Admin Endpoints RBAC ---');
  // GET /api/admin/users
  res = await request({ method: 'GET', path: '/api/admin/users' });
  record('Unauthenticated Admin API (/users)', 401, res.status, res.status === 401);

  res = await request({
    method: 'GET',
    path: '/api/admin/users',
    headers: { 'Authorization': `Bearer ${customerAToken}` }
  });
  record('Customer Admin API (/users)', 403, res.status, res.status === 403);

  res = await request({
    method: 'GET',
    path: '/api/admin/users',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  record('Admin Admin API (/users)', 200, res.status, res.status === 200);

  // PUT /api/admin/approvals/restaurant/fake-id
  res = await request({
    method: 'PUT',
    path: '/api/admin/approvals/restaurant/test-id-123',
    headers: { 'Authorization': `Bearer ${customerAToken}`, 'Content-Type': 'application/json' },
  }, { action: 'APPROVE' });
  record('Customer Admin PUT (/approvals/{type}/{id})', 403, res.status, res.status === 403);

  // 3. PART 3: Header Forgery Protection
  console.log('\n--- Phase 4: Header Forgery Protection ---');

  // Customer JWT + Forged X-User-Roles: ADMIN
  res = await request({
    method: 'GET',
    path: '/api/admin/approvals/pending',
    headers: {
      'Authorization': `Bearer ${customerAToken}`,
      'X-User-Roles': 'ADMIN',
      'X-User-Email': 'admin@smarteats.com'
    }
  });
  record('Forged X-User-Roles: ADMIN on Admin API', 403, res.status, res.status === 403, 'Customer token with spoofed role header blocked');

  // Unauthenticated + Forged X-User-Roles: ADMIN
  res = await request({
    method: 'GET',
    path: '/api/admin/approvals/pending',
    headers: {
      'X-User-Roles': 'ADMIN',
      'X-User-Email': 'admin@smarteats.com'
    }
  });
  record('Unauthenticated with forged X-User-Roles header', 401, res.status, res.status === 401, 'Perimeter rejects unauthenticated despite header');

  // 4. PART 2: Order Ownership & IDOR Protection
  console.log('\n--- Phase 5: Order IDOR & Ownership Verification ---');

  // First, find or create an order owned by Customer A
  let customerAOrdersRes = await request({
    method: 'GET',
    path: '/api/orders/customer',
    headers: { 'Authorization': `Bearer ${customerAToken}` }
  });

  let customerAOrderId = null;
  if (customerAOrdersRes.status === 200 && Array.isArray(customerAOrdersRes.data?.data) && customerAOrdersRes.data.data.length > 0) {
    customerAOrderId = customerAOrdersRes.data.data[0].id;
    console.log(`Found existing order for Customer A: ID=${customerAOrderId}`);
  } else {
    // Create an order for Customer A
    console.log('Creating fresh order for Customer A...');
    // Add item to cart
    await request({
      method: 'POST',
      path: '/api/orders/cart?restaurantId=rest-101',
      headers: { 'Authorization': `Bearer ${customerAToken}`, 'Content-Type': 'application/json' }
    }, {
      menuItemId: 'item-101',
      name: 'Paneer Butter Masala',
      quantity: 1,
      price: 240.0
    });
    // Checkout
    const checkoutRes = await request({
      method: 'POST',
      path: '/api/orders/checkout',
      headers: { 'Authorization': `Bearer ${customerAToken}` }
    });
    customerAOrderId = checkoutRes.data?.data?.id;
    console.log(`Created new order for Customer A: ID=${customerAOrderId}`);
  }

  if (!customerAOrderId) {
    console.error('Failed to obtain an order ID for Customer A');
    process.exit(1);
  }

  // Test 4.1: Customer A JWT -> GET /api/orders/{CustomerAOrderId} -> 200
  res = await request({
    method: 'GET',
    path: `/api/orders/${customerAOrderId}`,
    headers: { 'Authorization': `Bearer ${customerAToken}` }
  });
  record('Customer own order (Customer A -> Order A)', 200, res.status, res.status === 200);

  // Test 4.2: Customer B JWT -> GET /api/orders/{CustomerAOrderId} -> 403
  res = await request({
    method: 'GET',
    path: `/api/orders/${customerAOrderId}`,
    headers: { 'Authorization': `Bearer ${customerBToken}` }
  });
  record("Customer other user's order (Customer B -> Order A IDOR)", 403, res.status, res.status === 403, 'Cross-user IDOR access blocked');

  // Test 4.3: Unauthenticated order -> 401
  res = await request({
    method: 'GET',
    path: `/api/orders/${customerAOrderId}`
  });
  record('Unauthenticated order (No JWT -> Order A)', 401, res.status, res.status === 401);

  // Test 4.4: Customer B JWT + Forged X-User-Email: customer@smarteats.com -> 403
  res = await request({
    method: 'GET',
    path: `/api/orders/${customerAOrderId}`,
    headers: {
      'Authorization': `Bearer ${customerBToken}`,
      'X-User-Email': 'customer@smarteats.com'
    }
  });
  record("Forged X-User-Email (Customer B + spoofed Customer A email)", 403, res.status, res.status === 403, 'Gateway stripped spoofed email header; IDOR blocked');

  // Test 4.5: Customer B JWT + Forged X-User-Roles: ADMIN -> 403
  res = await request({
    method: 'GET',
    path: `/api/orders/${customerAOrderId}`,
    headers: {
      'Authorization': `Bearer ${customerBToken}`,
      'X-User-Roles': 'ADMIN'
    }
  });
  record("Forged X-User-Roles (Customer B + spoofed ADMIN role)", 403, res.status, res.status === 403, 'Gateway stripped spoofed role header; IDOR blocked');

  // Test 4.6: Admin JWT -> GET /api/orders/{CustomerAOrderId} -> 200 (Admin Exception)
  res = await request({
    method: 'GET',
    path: `/api/orders/${customerAOrderId}`,
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  record('Admin order inspection (Admin -> Order A)', 200, res.status, res.status === 200, 'Admin authorized to inspect orders');

  // 5. PART 5: Regression Testing (Legitimate Workflows)
  console.log('\n--- Phase 6: Regression Testing (Legitimate Workflows) ---');

  // Customer legitimate order history
  res = await request({
    method: 'GET',
    path: '/api/orders/customer',
    headers: { 'Authorization': `Bearer ${customerAToken}` }
  });
  record('Customer legitimate order history', 200, res.status, res.status === 200);

  // Restaurant legitimate order view
  res = await request({
    method: 'GET',
    path: '/api/orders/my/orders',
    headers: { 'Authorization': `Bearer ${restaurantToken}` }
  });
  record('Restaurant legitimate orders view', 200, res.status, res.status === 200);

  // Driver legitimate delivery view
  res = await request({
    method: 'GET',
    path: '/api/deliveries/my-deliveries',
    headers: { 'Authorization': `Bearer ${driverToken}` }
  });
  record('Driver legitimate deliveries view', 200, res.status, res.status === 200);

  // Admin legitimate dashboard/approval queue
  res = await request({
    method: 'GET',
    path: '/api/admin/approvals/pending',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  record('Admin legitimate approval queue view', 200, res.status, res.status === 200);

  // Summary Table
  console.log('\n====================================================');
  console.log('                 FINAL TEST SUMMARY                 ');
  console.log('====================================================');
  console.table(results.map(r => ({
    'Security Test': r.testName,
    'Expected': r.expected,
    'Actual': r.actual,
    'Status': r.status
  })));

  const allPassed = results.every(r => r.status === 'PASS');
  console.log(`\nOverall Result: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  process.exit(allPassed ? 0 : 1);
}

runSecurityTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
